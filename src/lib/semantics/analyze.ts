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
    StepNode,
    TyLabel
} from '../syntax/tools.js';
import * as builtins from './builtins.js';
import {
    AnalysisEnv,
    AnalyzeContext,
    anyType,
    arrayType,
    badType,
    boolType,
    charType,
    compareType,
    createExprSymbol,
    createFunctionSymbol,
    createFunctionType,
    createNamedType,
    createStructSymbol,
    createVariableSymbol,
    dispatchTypeError,
    FnSymbol,
    getTypeString,
    isNeverType,
    isPendingType,
    isValidType,
    neverType,
    numberType,
    pendingType,
    StatementResult,
    stringType,
    Symbol,
    Type,
    voidType
} from './tools.js';

export type AnalyzeResult = {
    success: boolean,
    errors: string[],
    warnings: string[],
};

export function analyze(
    source: SourceFile,
    env: AnalysisEnv,
    symbolTable: Map<AstNode, Symbol>,
    projectInfo: ProjectInfo
): AnalyzeResult {
    const a = new AnalyzeContext(env, symbolTable, projectInfo);
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

            if (!isValidType(targetTy)) {
                if (isPendingType(targetTy)) {
                    a.dispatchError('variable is not assigned yet.', node.target);
                }
                return undefined;
            }

            switch (targetTy.kind) {
                case 'NamedType': {
                    // get target symbol
                    const symbol = a.env.get(targetTy.name)!;

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
                case 'GenericType': {
                    throw new UguisuError('not implemented yet.'); // TODO
                }
                case 'AnyType': {
                    // TODO: Ensure that the type `any` is handled correctly.
                    return undefined;
                }
                case 'FunctionType':
                case 'VoidType': {
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
            if (compareType(indexTy, numberType) == 'incompatible') {
                dispatchTypeError(indexTy, numberType, node.index, a);
                return undefined;
            }

            if (!isValidType(targetTy)) {
                if (isPendingType(targetTy)) {
                    a.dispatchError('variable is not assigned yet.', node.target);
                }
                return undefined;
            }

            if (!isValidType(indexTy)) {
                if (isPendingType(indexTy)) {
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

function getTypeFromSymbol(symbol: Symbol, errorNode: AstNode, a: AnalyzeContext): Type {
    switch (symbol.kind) {
        case 'FnSymbol':
        case 'NativeFnSymbol': {
            return symbol.ty;
        }
        case 'StructSymbol': {
            return createNamedType(symbol.name);
        }
        case 'VariableSymbol': {
            return symbol.ty;
        }
        case 'ExprSymbol': {
            throw new UguisuError('unexpected symbol');
        }
    }
}

function resolveTyLabel(node: TyLabel, a: AnalyzeContext): Type {
    // builtin type
    switch (node.name) {
        case 'number':
        case 'bool':
        case 'char':
        case 'string':
        case 'array': {
            return createNamedType(node.name);
        }
    }

    // try get user defined type
    const symbol = a.env.get(node.name);
    if (symbol == null) {
        a.dispatchError('unknown type name.', node);
        return badType;
    }

    switch (symbol.kind) {
        case 'StructSymbol': {
            return createNamedType(node.name);
        }
        case 'FnSymbol':
        case 'NativeFnSymbol':
        case 'VariableSymbol':
        case 'ExprSymbol': {
            a.dispatchError('invalid type name.', node);
            return badType;
        }
    }
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
            const symbol = createFunctionSymbol(params, pendingType, []);
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
                const fieldSymbol = createVariableSymbol(pendingType, true);
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
                    paramsTy.push(badType);
                    continue;
                }

                // get param type
                const paramTy = resolveTyLabel(paramNode.ty, a);
                paramsTy.push(paramTy);
            }

            // replace function type
            symbol.ty = createFunctionType(paramsTy, returnTy);
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
            if (!isValidType(symbol.ty)) {
                if (isPendingType(symbol.ty)) {
                    a.dispatchError('function is not defined yet.', node);
                }
                return;
            }
            const fnType = symbol.ty;

            const beforeAnalyzeBlock = () => {
                // set function params to the env
                for (let i = 0; i < node.params.length; i++) {
                    const paramSymbol = createVariableSymbol(fnType.paramTypes[i], true);
                    a.symbolTable.set(node.params[i], paramSymbol);
                    a.env.set(node.params[i].name, paramSymbol);
                }
            }

            // analyze function body
            const ty = analyzeBlock(node.body, false, symbol, a, beforeAnalyzeBlock);

            // check return type
            if (!isNeverType(ty)) {
                if (compareType(ty, symbol.ty.returnType) == 'incompatible') {
                    dispatchTypeError(ty, symbol.ty.returnType, node, a);
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
    if (isPendingType(funcSymbol.ty)) {
        throw new UguisuError('unexpected type');
    }
    if (!isValidType(funcSymbol.ty)) {
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
                }
                case 'error': {
                    ty = badType;
                }
                case 'return':
                case 'break': {
                    ty = neverType;
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
                    ty = badType;
                }

                if (!isValidType(funcSymbol.ty)) {
                    if (isPendingType(funcSymbol.ty)) {
                        throw new UguisuError('unexpected type');
                    }
                    return 'error';
                }

                // check type
                if (compareType(ty, funcSymbol.ty.returnType) == 'incompatible') {
                    dispatchTypeError(ty, funcSymbol.ty.returnType, node.expr, a);
                    return 'error';
                }
            }
            return 'return';
        }
        case 'BreakStatement': {
            // if there is no associated loop
            if (!allowJump) {
                a.dispatchError('invalid break statement.');
                return 'error';
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
            let ty: Type = pendingType;

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
                    bodyTy = badType;
                }

                // if the variable type is not decided
                if (ty.kind == 'PendingType') {
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
                bodyTy = badType;
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
                return 'error';
            }

            let targetTy = getTypeFromSymbol(symbol, node.target, a);

            // if it was the first assignment
            if (symbol.kind == 'VariableSymbol' && !symbol.isDefined) {
                // if need inference
                if (isPendingType(targetTy)) {
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
                    if (compareType(targetTy, numberType) == 'incompatible') {
                        dispatchTypeError(targetTy, numberType, node.target, a);
                    }
                    if (compareType(bodyTy, numberType) == 'incompatible') {
                        dispatchTypeError(bodyTy, numberType, node.body, a);
                    }
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
                return badType;
            }

            // get expr type from the symbol
            const ty = getTypeFromSymbol(symbol, node, a);

            // if the variable is not assigned
            if (symbol.kind == 'VariableSymbol' && !symbol.isDefined) {
                a.dispatchError('variable is not assigned yet.', node);
                return badType;
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
                return badType;
            }

            a.symbolTable.set(node.callee, calleeSymbol);

            // check callable
            let calleeTy;
            switch (calleeSymbol.kind) {
                case 'FnSymbol':
                case 'NativeFnSymbol': {
                    calleeTy = calleeSymbol.ty;
                    break;
                }
                case 'StructSymbol': {
                    a.dispatchError('struct is not callable.', node.callee);
                    return badType;
                }
                case 'VariableSymbol': {
                    // if the variable is not assigned
                    if (isPendingType(calleeSymbol.ty)) {
                        a.dispatchError('variable is not assigned yet.', node.callee);
                        return badType;
                    }

                    if (!isValidType(calleeSymbol.ty)) {
                        return badType;
                    }

                    // expect function
                    if (calleeSymbol.ty.kind != 'FunctionType') {
                        a.dispatchError(`type mismatched. expected function, found \`${getTypeString(calleeSymbol.ty)}\``, node.callee);
                        return badType;
                    }

                    calleeTy = calleeSymbol.ty;
                    break;
                }
                case 'ExprSymbol': {
                    throw new UguisuError('unexpected symbol');
                }
            }

            if (!isValidType(calleeTy)) {
                if (isPendingType(calleeTy)) {
                    a.dispatchError('callee is not assigned yet.', node.callee);
                }
                return badType;
            }

            let isCorrectArgCount = true;
            if (node.args.length != calleeTy.paramTypes.length) {
                a.dispatchError('argument count incorrect.', node);
                isCorrectArgCount = false;
            }

            if (isCorrectArgCount) {
                for (let i = 0; i < calleeTy.paramTypes.length; i++) {
                    let argTy = analyzeExpr(node.args[i], allowJump, funcSymbol, a);

                    if (isPendingType(argTy)) {
                        a.dispatchError('variable is not assigned yet.', node.args[i]);
                        argTy = badType;
                    }

                    // if the argument returns nothing
                    if (compareType(argTy, voidType) == 'compatible') {
                        a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.args[i]);
                        argTy = badType;
                    }

                    const paramTy = calleeTy.paramTypes[i];

                    if (!isValidType(argTy) || !isValidType(paramTy)) {
                        continue;
                    }

                    if (compareType(argTy, paramTy) == 'incompatible') {
                        dispatchTypeError(argTy, paramTy, node.args[i], a);
                    }
                }
            }

            a.symbolTable.set(node, createExprSymbol(calleeTy.returnType));
            return calleeTy.returnType;
        }
        case 'BinaryOp': {
            let leftTy = analyzeExpr(node.left, allowJump, funcSymbol, a);
            let rightTy = analyzeExpr(node.right, allowJump, funcSymbol, a);

            // check assigned
            if (isPendingType(leftTy)) {
                a.dispatchError('variable is not assigned yet.', node.left);
                leftTy = badType;
            }
            if (isPendingType(rightTy)) {
                a.dispatchError('variable is not assigned yet.', node.right);
                rightTy = badType;
            }

            // if the expr returns nothing
            if (compareType(leftTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.left);
                leftTy = badType;
            }
            if (compareType(rightTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.right);
                rightTy = badType;
            }

            if (!isValidType(leftTy) || !isValidType(rightTy)) {
                return badType;
            }

            if (isLogicalBinaryOperator(node.operator)) {
                // Logical Operation
                if (compareType(leftTy, boolType) == 'incompatible') {
                    dispatchTypeError(leftTy, boolType, node.left, a);
                    return badType;
                }
                if (compareType(rightTy, boolType) == 'incompatible') {
                    dispatchTypeError(rightTy, boolType, node.right, a);
                    return badType;
                }

                a.symbolTable.set(node, createExprSymbol(boolType));
                return boolType;
            } else if (isEquivalentOperator(node.operator)) {
                // Equivalent Operation
                if (compareType(rightTy, leftTy) == 'incompatible') {
                    dispatchTypeError(rightTy, leftTy, node.right, a);
                    return badType;
                }

                a.symbolTable.set(node, createExprSymbol(boolType));
                return boolType;
            } else if (isOrderingOperator(node.operator)) {
                // Ordering Operation
                if (compareType(leftTy, numberType) == 'incompatible') {
                    dispatchTypeError(leftTy, numberType, node.left, a);
                }
                if (compareType(rightTy, numberType) == 'incompatible') {
                    dispatchTypeError(rightTy, numberType, node.right, a);
                }

                a.symbolTable.set(node, createExprSymbol(boolType));
                return boolType;
            } else {
                // Arithmetic Operation
                if (compareType(leftTy, numberType) == 'incompatible') {
                    dispatchTypeError(leftTy, numberType, node.left, a);
                }
                if (compareType(rightTy, numberType) == 'incompatible') {
                    dispatchTypeError(rightTy, numberType, node.right, a);
                }

                a.symbolTable.set(node, createExprSymbol(numberType));
                return numberType;
            }
            break;
        }
        case 'UnaryOp': {
            let ty = analyzeExpr(node.expr, allowJump, funcSymbol, a);

            // if the expr returns nothing
            if (compareType(ty, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                ty = badType;
            }

            if (!isValidType(ty)) {
                if (isPendingType(ty)) {
                    a.dispatchError('variable is not assigned yet.', node.expr);
                    ty = badType;
                }
                return badType;
            }

            // Logical Operation
            if (compareType(ty, boolType) == 'incompatible') {
                dispatchTypeError(ty, boolType, node, a);
                return badType;
            }
            a.symbolTable.set(node, createExprSymbol(boolType));
            return boolType;
        }
        case 'StructExpr': {
            // get symbol
            const symbol = a.env.get(node.name);
            if (symbol == null) {
                a.dispatchError('unknown identifier.', node);
                return badType;
            }

            // expect struct symbol
            if (symbol.kind != 'StructSymbol') {
                a.dispatchError('struct expected.', node);
                return badType;
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
                    bodyTy = badType;
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

            return createNamedType(symbol.name);
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
                condTy = badType;
            }

            // check cond
            if (compareType(condTy, boolType) == 'incompatible') {
                dispatchTypeError(condTy, boolType, node.cond, a);
            }

            // check blocks
            if (!isNeverType(thenTy) && isNeverType(elseTy)) {
                return thenTy;
            }
            if (isNeverType(thenTy) && !isNeverType(elseTy)) {
                return elseTy;
            }
            if (compareType(elseTy, thenTy) == 'incompatible') {
                dispatchTypeError(elseTy, thenTy, node, a);
                return badType;
            }

            return thenTy;
        }
    }
    throw new UguisuError('unexpected node');
}
