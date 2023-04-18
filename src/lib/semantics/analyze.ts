import charRegex from 'char-regex';
import { UguisuError } from '../misc/errors.js';
import { ProjectInfo } from '../project-file.js';
import {
    AstNode,
    ExprNode,
    FileNode,
    isEquivalentOperator,
    isExprNode,
    isLogicalBinaryOperator,
    isOrderingOperator,
    ReferenceExpr,
    SourceFile,
    StatementNode,
    StepNode
} from '../syntax/tools.js';
import * as builtins from './builtins.js';
import {
    AnalysisEnv,
    AnalyzeContext,
    createExprSymbol,
    createFunctionSymbol,
    createStructSymbol,
    createVariableSymbol,
    dispatchTypeError,
    FnSymbol,
    StatementResult,
    Symbol
} from './tools.js';
import {
    anyType,
    arrayType,
    boolType,
    charType,
    checkIfArithOpsSupported,
    checkIfIndexSupported,
    checkIfLogicalOpsSupported,
    checkIfOrderOpsSupported,
    compareType,
    FunctionType,
    getTypeFromSymbol,
    getTypeString,
    invalidType,
    isNamedType,
    isSpecialType,
    NamedType,
    neverType,
    numberType,
    resolveTyLabel,
    stringType,
    Type,
    TypeEnv,
    unresolvedType,
    voidType
} from './types.js';

export type AnalyzeResult = {
    success: boolean,
    errors: string[],
    warnings: string[],
};

export function analyze(
    source: SourceFile,
    env: AnalysisEnv,
    typeEnv: TypeEnv,
    symbolTable: Map<AstNode, Symbol>,
    projectInfo: ProjectInfo
): AnalyzeResult {
    const a = new AnalyzeContext(env, typeEnv, symbolTable, projectInfo);
    builtins.setDeclarations(a);

    // 1st phase: declare
    for (const node of source.decls) {
        declareTopLevel(node, a);
    }
    // 2nd phase: resolve
    for (const node of source.decls) {
        resolveTopLevel(node, a);
    }
    // 3rd phase: analyze
    for (const node of source.decls) {
        analyzeTopLevel(node, a);
    }

    if (a.isUsedAnyType) {
        a.dispatchWarn('type checking of array elements is not supported yet.');
    }

    return {
        success: (a.error.length == 0),
        errors: a.error,
        warnings: a.warn,
    };
}

function declareTopLevel(node: FileNode, a: AnalyzeContext) {
    switch (node.kind) {
        case 'FunctionDecl': {
            // check for duplicate
            if (a.env.get(node.name) != null) {
                a.dispatchError(`\`${node.name}\` is already declared.`);
                return;
            }

            // export specifier
            if (node.exported) {
                a.dispatchWarn('exported function is not supported yet.', node);
            }

            // make param list
            const params = node.params.map(x => ({ name: x.name }));

            // declare function
            const symbol = createFunctionSymbol(params, unresolvedType, []);
            a.symbolTable.set(node, symbol);
            a.env.set(node.name, symbol);
            break;
        }
        case 'StructDecl': {
            // check for duplicate
            if (a.env.get(node.name) != null) {
                a.dispatchError(`\`${node.name}\` is already declared.`);
                return;
            }

            // export specifier
            if (node.exported) {
                a.dispatchWarn('exported function is not supported yet.', node);
            }

            // make fields
            const fields = new Map<string, Symbol>();
            for (const field of node.fields) {
                const fieldSymbol = createVariableSymbol(unresolvedType, true);
                fields.set(field.name, fieldSymbol);
            }

            // declare struct
            const symbol: Symbol = createStructSymbol(node.name, fields);
            a.symbolTable.set(node, symbol);
            a.env.set(node.name, symbol);
            break;
        }
    }
}

function resolveTopLevel(node: FileNode, a: AnalyzeContext) {
    switch (node.kind) {
        case 'FunctionDecl': {
            // get symbol
            const symbol = a.env.get(node.name);
            if (symbol == null) {
                throw new UguisuError('symbol not found.');
            }

            // expect function symbol
            if (symbol.kind != 'FnSymbol') {
                a.dispatchError('function expected.', node);
                return;
            }

            // make return type
            let returnTy: Type;
            if (node.returnTy != null) {
                returnTy = resolveTyLabel(node.returnTy, a);
            } else {
                returnTy = voidType;
            }

            // make params type
            let paramsTy: Type[] = [];
            for (let i = 0; i < symbol.params.length; i++) {
                const paramNode = node.params[i];

                // if param type is not specified
                if (paramNode.ty == null) {
                    a.dispatchError('parameter type missing.', paramNode);
                    paramsTy.push(invalidType);
                    continue;
                }

                // get param type
                const paramTy = resolveTyLabel(paramNode.ty, a);
                paramsTy.push(paramTy);
            }

            // replace function type
            symbol.ty = new FunctionType({
                isMethod: false,
                fnParamTypes: paramsTy,
                fnReturnType: returnTy,
            });
            break;
        }
        case 'StructDecl': {
            // get symbol
            const structSymbol = a.env.get(node.name);
            if (structSymbol == null) {
                throw new UguisuError('symbol not found.');
            }

            // expect struct symbol
            if (structSymbol.kind != 'StructSymbol') {
                a.dispatchError('struct expected.', node);
                return;
            }

            for (const field of node.fields) {
                // get field symbol
                const fieldSymbol = structSymbol.fields.get(field.name);
                if (fieldSymbol == null) {
                    throw new UguisuError('symbol not found.');
                }

                // expect variable symbol
                if (fieldSymbol.kind != 'VariableSymbol') {
                    throw new UguisuError('invalid field symbol.');
                }

                // replace field type
                fieldSymbol.ty = resolveTyLabel(field.ty, a);
            }
            break;
        }
    }
}

function analyzeTopLevel(node: FileNode, a: AnalyzeContext) {
    switch (node.kind) {
        case 'FunctionDecl': {
            // get function symbol
            const symbol = a.env.get(node.name);
            if (symbol == null) {
                throw new UguisuError('symbol not found.');
            }

            // expect function symbol
            if (symbol.kind != 'FnSymbol') {
                a.dispatchError('function expected.', node);
                return;
            }

            // check the function type is valid
            if (isNamedType(symbol.ty)) {
                if (isSpecialType(symbol.ty, 'invalid') || isSpecialType(symbol.ty, 'unresolved')) {
                    if (isSpecialType(symbol.ty, 'unresolved')) {
                        a.dispatchError('function is not defined yet.', node);
                    }
                    return;
                }
                throw new UguisuError('function type expected');
            }
            const fnType = symbol.ty;

            const beforeAnalyzeBlock = () => {
                // set function params to the env
                for (let i = 0; i < node.params.length; i++) {
                    const paramSymbol = createVariableSymbol(fnType.fnParamTypes[i], true);
                    a.symbolTable.set(node.params[i], paramSymbol);
                    a.env.set(node.params[i].name, paramSymbol);
                }
            }

            // analyze function body
            const ty = analyzeBlock(node.body, false, symbol, a, beforeAnalyzeBlock);

            // check return type
            if (!isSpecialType(ty, 'never')) {
                if (compareType(ty, symbol.ty.fnReturnType) == 'incompatible') {
                    dispatchTypeError(ty, symbol.ty.fnReturnType, node, a);
                }
            }
            break;
        }
        case 'StructDecl': {
            // nop
            break;
        }
    }
}

/**
 * @returns type of the last step of the block
*/
function analyzeBlock(nodes: StepNode[], allowJump: boolean, funcSymbol: FnSymbol, a: AnalyzeContext, before?: () => void): Type {
    if (isSpecialType(funcSymbol.ty, 'unresolved')) {
        throw new UguisuError('unexpected type');
    }
    if (isSpecialType(funcSymbol.ty, 'invalid')) {
        throw new UguisuError('unexpected type');
    }

    a.env.enter();

    if (before != null) {
        before();
    }

    let blockTy: Type = voidType;

    // analyze inner
    for (let i = 0; i < nodes.length; i++) {
        const step = nodes[i];

        let ty;
        if (isExprNode(step)) {
            ty = analyzeExpr(step, allowJump, funcSymbol, a);
        } else {
            const result = analyzeStatement(step, allowJump, funcSymbol, a);
            switch (result) {
                case 'ok': {
                    ty = voidType;
                    break;
                }
                case 'invalid': {
                    ty = invalidType;
                    break;
                }
                case 'return':
                case 'break': {
                    ty = neverType;
                    break;
                }
            }
        }

        const isFinalStep = (i == nodes.length - 1);
        if (isFinalStep) {
            blockTy = ty;
        } else {
            // check void
            if (compareType(ty, voidType) == 'incompatible') {
                dispatchTypeError(ty, voidType, step, a);
            }
        }
    }

    a.env.leave();

    return blockTy;
}

function analyzeReferenceExpr(node: ReferenceExpr, allowJump: boolean, funcSymbol: FnSymbol, a: AnalyzeContext): Symbol | undefined {
    switch (node.kind) {
        case 'Identifier': {
            // get symbol
            const symbol = a.env.get(node.name);

            if (symbol == null) {
                a.dispatchError('unknown identifier.', node);
                return undefined;
            }

            return symbol;
        }
        case 'FieldAccess': {
            // analyze target
            const targetTy = analyzeExpr(node.target, allowJump, funcSymbol, a);

            if (isSpecialType(targetTy, 'invalid') || isSpecialType(targetTy, 'unresolved')) {
                if (isSpecialType(targetTy, 'unresolved')) {
                    a.dispatchError('variable is not assigned yet.', node.target);
                }
                return undefined;
            }

            switch (targetTy.kind) {
                case 'NamedType': {
                    if (targetTy.typeParams.length > 0) {
                        throw new UguisuError('not implemented yet.'); // TODO
                    }

                    if (isSpecialType(targetTy, 'any')) {
                        // TODO: Ensure that the type `any` is handled correctly.
                        return undefined;
                    }

                    if (isSpecialType(targetTy, 'void')) {
                        a.dispatchError('invalid field access');
                        return undefined;
                    }

                    // get target symbol
                    const symbol = a.env.get(targetTy.name);
                    if (symbol == null) {
                        a.dispatchError('unknown identifier.', node.target);
                        return undefined;
                    }

                    if (symbol.kind == 'StructSymbol') {
                        // get field symbol
                        const field = symbol.fields.get(node.name);

                        // if specified field name is invalid
                        if (field == null) {
                            a.dispatchError('unknown field name.', node);
                            return undefined;
                        }

                        return field;
                    } else {
                        a.dispatchError('invalid field access.', node);
                        return undefined;
                    }
                    break;
                }
                case 'FunctionType': {
                    a.dispatchError('invalid field access');
                    return undefined;
                }
            }
            break;
        }
        case 'IndexAccess': {
            const targetTy = analyzeExpr(node.target, allowJump, funcSymbol, a);
            const indexTy = analyzeExpr(node.index, allowJump, funcSymbol, a);

            // check target type
            if (compareType(targetTy, arrayType) == 'incompatible') {
                dispatchTypeError(targetTy, arrayType, node.target, a);
                return undefined;
            }

            // check index type
            if (!checkIfIndexSupported(indexTy, node.index, a)) {
                return undefined;
            }

            if (isSpecialType(targetTy, 'invalid') || isSpecialType(targetTy, 'unresolved')) {
                if (isSpecialType(targetTy, 'unresolved')) {
                    a.dispatchError('variable is not assigned yet.', node.target);
                }
                return undefined;
            }

            if (isSpecialType(indexTy, 'invalid') || isSpecialType(indexTy, 'unresolved')) {
                if (isSpecialType(indexTy, 'unresolved')) {
                    a.dispatchError('variable is not assigned yet.', node.index);
                }
                return undefined;
            }

            // create index symbol
            const symbol = createVariableSymbol(anyType, true);
            return symbol;
        }
    }
    throw new UguisuError('unexpected node');
}

function analyzeStatement(node: StatementNode, allowJump: boolean, funcSymbol: FnSymbol, a: AnalyzeContext): StatementResult {
    switch (node.kind) {
        case 'ExprStatement': {
            analyzeExpr(node.expr, allowJump, funcSymbol, a);
            return 'ok';
        }
        case 'ReturnStatement': {
            // if there is a return value
            if (node.expr != null) {
                let ty = analyzeExpr(node.expr, allowJump, funcSymbol, a);

                // if the expr returned nothing
                if (compareType(ty, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                    ty = invalidType;
                }

                if (isNamedType(funcSymbol.ty)) {
                    if (isSpecialType(funcSymbol.ty, 'invalid') || isSpecialType(funcSymbol.ty, 'unresolved')) {
                        if (isSpecialType(funcSymbol.ty, 'unresolved')) {
                            throw new UguisuError('unexpected type');
                        }
                        return 'invalid';
                    }
                    throw new UguisuError('function type expected');
                }

                // check type
                if (compareType(ty, funcSymbol.ty.fnReturnType) == 'incompatible') {
                    dispatchTypeError(ty, funcSymbol.ty.fnReturnType, node.expr, a);
                    return 'invalid';
                }
            }
            return 'return';
        }
        case 'BreakStatement': {
            // if there is no associated loop
            if (!allowJump) {
                a.dispatchError('invalid break statement.');
                return 'invalid';
            }
            return 'break';
        }
        case 'LoopStatement': {
            // allow break
            allowJump = true;

            const ty = analyzeBlock(node.block, allowJump, funcSymbol, a);

            // check block
            if (compareType(ty, voidType) == 'incompatible') {
                dispatchTypeError(ty, voidType, node, a);
            }
            return 'ok';
        }
        case 'VariableDecl': {
            let isDefined = false;
            let ty: Type = unresolvedType;

            // if an explicit type is specified
            if (node.ty != null) {
                ty = resolveTyLabel(node.ty, a);
            }

            // initializer
            if (node.body != null) {
                let bodyTy = analyzeExpr(node.body, allowJump, funcSymbol, a);

                // if the initializer returns nothing
                if (compareType(bodyTy, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                    bodyTy = invalidType;
                }

                // if the variable type is not decided
                if (isSpecialType(ty, 'unresolved')) {
                    ty = bodyTy;
                }

                // check type
                if (compareType(bodyTy, ty) == 'incompatible') {
                    dispatchTypeError(bodyTy, ty, node.body, a);
                }

                isDefined = true;
            }

            // set symbol
            const symbol = createVariableSymbol(ty, isDefined);
            a.symbolTable.set(node, symbol);
            a.env.set(node.name, symbol);

            return 'ok';
        }
        case 'AssignStatement': {
            let bodyTy = analyzeExpr(node.body, allowJump, funcSymbol, a);

            // if the body returns nothing
            if (compareType(bodyTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                bodyTy = invalidType;
            }

            // analyze target
            let symbol;
            if (node.target.kind == 'Identifier' || node.target.kind == 'FieldAccess' || node.target.kind == 'IndexAccess') {
                symbol = analyzeReferenceExpr(node.target, allowJump, funcSymbol, a);
            } else {
                a.dispatchError('invalid assign target.');
            }

            // skip if target symbol is invalid
            if (symbol == null) {
                return 'invalid';
            }

            let targetTy = getTypeFromSymbol(symbol, node.target, a);

            // if it was the first assignment
            if (symbol.kind == 'VariableSymbol' && !symbol.isDefined) {
                // if need inference
                if (isSpecialType(targetTy, 'unresolved')) {
                    targetTy = bodyTy;
                    symbol.ty = targetTy;
                }
                symbol.isDefined = true;
            }

            // check type
            switch (node.mode) {
                case '=': {
                    if (compareType(bodyTy, targetTy) == 'incompatible') {
                        dispatchTypeError(bodyTy, targetTy, node.body, a);
                    }
                    break;
                }
                case '+=':
                case '-=':
                case '*=':
                case '/=':
                case '%=': {
                    checkIfArithOpsSupported(targetTy, node.target, a);
                    checkIfArithOpsSupported(bodyTy, node.body, a);
                    break;
                }
            }
            return 'ok';
        }
    }
    throw new UguisuError('unexpected node');
}

function analyzeExpr(node: ExprNode, allowJump: boolean, funcSymbol: FnSymbol, a: AnalyzeContext): Type {
    // validate expression
    switch (node.kind) {
        case 'Identifier':
        case 'FieldAccess':
        case 'IndexAccess': {
            const symbol = analyzeReferenceExpr(node, allowJump, funcSymbol, a);
            if (symbol == null) {
                return invalidType;
            }

            // get expr type from the symbol
            const ty = getTypeFromSymbol(symbol, node, a);

            // if the variable is not assigned
            if (symbol.kind == 'VariableSymbol' && !symbol.isDefined) {
                a.dispatchError('variable is not assigned yet.', node);
                return invalidType;
            }

            return ty;
        }
        case 'NumberLiteral': {
            // return expr type
            return numberType;
        }
        case 'BoolLiteral': {
            // return expr type
            return boolType;
        }
        case 'CharLiteral': {
            // check if literal is valid
            const arr = node.value.match(charRegex());
            if (arr == null || arr.length > 1) {
                a.dispatchError('invalid char literal.', node);
            }
            // return expr type
            return charType;
        }
        case 'StringLiteral': {
            // return expr type
            return stringType;
        }
        case 'Call': {
            let calleeSymbol;
            if (node.callee.kind == 'Identifier' || node.callee.kind == 'FieldAccess' || node.callee.kind == 'IndexAccess') {
                calleeSymbol = analyzeReferenceExpr(node.callee, allowJump, funcSymbol, a);
            } else {
                a.dispatchError('invalid callee.');
            }

            if (calleeSymbol == null) {
                return invalidType;
            }

            a.symbolTable.set(node.callee, calleeSymbol);

            // check callable
            let calleeTy: Type;
            switch (calleeSymbol.kind) {
                case 'FnSymbol':
                case 'NativeFnSymbol': {
                    calleeTy = calleeSymbol.ty;
                    break;
                }
                case 'StructSymbol': {
                    a.dispatchError('struct is not callable.', node.callee);
                    return invalidType;
                }
                case 'VariableSymbol': {
                    // if the variable is not assigned
                    if (isSpecialType(calleeSymbol.ty, 'unresolved')) {
                        a.dispatchError('variable is not assigned yet.', node.callee);
                        return invalidType;
                    }

                    if (isSpecialType(calleeSymbol.ty, 'invalid')) {
                        return invalidType;
                    }

                    // expect function
                    if (calleeSymbol.ty.kind != 'FunctionType') {
                        a.dispatchError(`type mismatched. expected function, found \`${getTypeString(calleeSymbol.ty)}\``, node.callee);
                        return invalidType;
                    }

                    calleeTy = calleeSymbol.ty;
                    break;
                }
                case 'ExprSymbol': {
                    throw new UguisuError('unexpected symbol');
                }
            }

            if (isNamedType(calleeTy)) {
                if (isSpecialType(calleeTy, 'invalid') || isSpecialType(calleeTy, 'unresolved')) {
                    if (isSpecialType(calleeTy, 'unresolved')) {
                        a.dispatchError('callee is not assigned yet.', node.callee);
                    }
                    return invalidType;
                }
                throw new UguisuError('function type expected');
            }

            let isCorrectArgCount = true;
            if (node.args.length != calleeTy.fnParamTypes.length) {
                a.dispatchError('argument count incorrect.', node);
                isCorrectArgCount = false;
            }

            if (isCorrectArgCount) {
                for (let i = 0; i < calleeTy.fnParamTypes.length; i++) {
                    let argTy = analyzeExpr(node.args[i], allowJump, funcSymbol, a);

                    if (isSpecialType(argTy, 'unresolved')) {
                        a.dispatchError('variable is not assigned yet.', node.args[i]);
                        argTy = invalidType;
                    }

                    // if the argument returns nothing
                    if (compareType(argTy, voidType) == 'compatible') {
                        a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.args[i]);
                        argTy = invalidType;
                    }

                    const paramTy = calleeTy.fnParamTypes[i];

                    if (isSpecialType(argTy, 'unresolved') || isSpecialType(argTy, 'invalid')) {
                        continue;
                    }
                    if (isSpecialType(paramTy, 'unresolved') || isSpecialType(paramTy, 'invalid')) {
                        continue;
                    }

                    if (compareType(argTy, paramTy) == 'incompatible') {
                        dispatchTypeError(argTy, paramTy, node.args[i], a);
                    }
                }
            }

            a.symbolTable.set(node, createExprSymbol(calleeTy.fnReturnType));
            return calleeTy.fnReturnType;
        }
        case 'BinaryOp': {
            let leftTy = analyzeExpr(node.left, allowJump, funcSymbol, a);
            let rightTy = analyzeExpr(node.right, allowJump, funcSymbol, a);

            // check assigned
            if (isSpecialType(leftTy, 'unresolved')) {
                a.dispatchError('variable is not assigned yet.', node.left);
                leftTy = invalidType;
            }
            if (isSpecialType(rightTy, 'unresolved')) {
                a.dispatchError('variable is not assigned yet.', node.right);
                rightTy = invalidType;
            }

            // if the expr returns nothing
            if (compareType(leftTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.left);
                leftTy = invalidType;
            }
            if (compareType(rightTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.right);
                rightTy = invalidType;
            }

            if (isSpecialType(leftTy, 'invalid') || isSpecialType(rightTy, 'invalid')) {
                return invalidType;
            }

            if (isLogicalBinaryOperator(node.operator)) {
                // Logical Operation
                if (!checkIfLogicalOpsSupported(leftTy, node.left, a)) {
                    return invalidType;
                }
                if (!checkIfLogicalOpsSupported(rightTy, node.right, a)) {
                    return invalidType;
                }

                if (compareType(rightTy, leftTy) == 'incompatible') {
                    dispatchTypeError(rightTy, leftTy, node.right, a);
                    return invalidType;
                }

                a.symbolTable.set(node, createExprSymbol(leftTy));
                return leftTy;
            } else if (isEquivalentOperator(node.operator)) {
                // Equivalent Operation
                if (compareType(rightTy, leftTy) == 'incompatible') {
                    dispatchTypeError(rightTy, leftTy, node.right, a);
                    return invalidType;
                }

                a.symbolTable.set(node, createExprSymbol(boolType));
                return boolType;
            } else if (isOrderingOperator(node.operator)) {
                // Ordering Operation
                checkIfOrderOpsSupported(leftTy, node.left, a);
                checkIfOrderOpsSupported(rightTy, node.right, a);

                if (compareType(rightTy, leftTy) == 'incompatible') {
                    dispatchTypeError(rightTy, leftTy, node.right, a);
                    return invalidType;
                }

                a.symbolTable.set(node, createExprSymbol(boolType));
                return boolType;
            } else {
                // Arithmetic Operation
                checkIfArithOpsSupported(leftTy, node.left, a);
                checkIfArithOpsSupported(rightTy, node.right, a);

                if (compareType(rightTy, leftTy) == 'incompatible') {
                    dispatchTypeError(rightTy, leftTy, node.right, a);
                    return invalidType;
                }

                a.symbolTable.set(node, createExprSymbol(leftTy));
                return leftTy;
            }
            break;
        }
        case 'UnaryOp': {
            let ty = analyzeExpr(node.expr, allowJump, funcSymbol, a);

            // check assigned
            if (isSpecialType(ty, 'unresolved')) {
                a.dispatchError('variable is not assigned yet.', node.expr);
                ty = invalidType;
            }

            // if the expr returns nothing
            if (compareType(ty, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                ty = invalidType;
            }

            if (isSpecialType(ty, 'invalid')) {
                return invalidType;
            }

            // Logical Operation
            if (!checkIfLogicalOpsSupported(ty, node, a)) {
                return invalidType;
            }
            a.symbolTable.set(node, createExprSymbol(ty));
            return ty;
        }
        case 'StructExpr': {
            // get symbol
            const symbol = a.env.get(node.name);
            if (symbol == null) {
                a.dispatchError('unknown identifier.', node);
                return invalidType;
            }

            // expect struct symbol
            if (symbol.kind != 'StructSymbol') {
                a.dispatchError('struct expected.', node);
                return invalidType;
            }

            const defined: string[] = [];
            for (const fieldNode of node.fields) {
                // check already defined
                if (defined.indexOf(fieldNode.name) != -1) {
                    a.dispatchError(`field \`${fieldNode.name}\` is duplicated.`, fieldNode);
                }
                defined.push(fieldNode.name);

                // analyze field
                let bodyTy = analyzeExpr(fieldNode.body, allowJump, funcSymbol, a);

                // TODO: check pending?

                // if the expr returns nothing
                if (compareType(bodyTy, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, fieldNode.body);
                    bodyTy = invalidType;
                }

                // get field symbol
                const fieldSymbol = symbol.fields.get(fieldNode.name)!;

                // expect variable symbol
                if (fieldSymbol.kind != 'VariableSymbol') {
                    throw new UguisuError('invalid field symbol.');
                }

                // check field type
                if (compareType(bodyTy, fieldSymbol.ty) == 'incompatible') {
                    dispatchTypeError(bodyTy, fieldSymbol.ty, fieldNode.body, a);
                }
            }

            // check fields are all defined
            for (const [name, _field] of symbol.fields) {
                if (!defined.includes(name)) {
                    a.dispatchError(`field \`${name}\` is not initialized.`, node);
                }
            }

            return new NamedType(symbol.name);
        }
        case 'ArrayNode': {
            // analyze elements
            for (const item of node.items) {
                analyzeExpr(item, allowJump, funcSymbol, a);

                // TODO: check type
            }

            // return expr type
            return arrayType;
        }
        case 'IfExpr': {
            let condTy = analyzeExpr(node.cond, allowJump, funcSymbol, a);
            const thenTy = analyzeBlock(node.thenBlock, allowJump, funcSymbol, a);
            const elseTy = analyzeBlock(node.elseBlock, allowJump, funcSymbol, a);

            // if the condition expr returned nothing
            if (compareType(condTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.cond);
                condTy = invalidType;
            }

            // check cond
            if (compareType(condTy, boolType) == 'incompatible') {
                dispatchTypeError(condTy, boolType, node.cond, a);
            }

            // check blocks
            if (!isSpecialType(thenTy, 'never') && isSpecialType(elseTy, 'never')) {
                return thenTy;
            }
            if (isSpecialType(thenTy, 'never') && !isSpecialType(elseTy, 'never')) {
                return elseTy;
            }
            if (compareType(elseTy, thenTy) == 'incompatible') {
                dispatchTypeError(elseTy, thenTy, node, a);
                return invalidType;
            }

            return thenTy;
        }
    }
    throw new UguisuError('unexpected node');
}
