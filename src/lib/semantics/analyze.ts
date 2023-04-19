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
    createExprSymbol,
    createFunctionSymbol,
    createStructSymbol,
    createVariableSymbol,
    FnSymbol,
    Symbol
} from './symbols.js';
import { SymbolEnv, AnalyzeContext } from './tools.js';
import {
    anyType,
    arrayType,
    invalidType,
    boolType,
    charType,
    checkIfArithOpsSupported,
    checkIfIndexSupported,
    checkIfLogicalOpsSupported,
    checkIfOrderOpsSupported,
    compareType,
    dispatchTypeError,
    FunctionType,
    getTypeFromSymbol,
    getTypeString,
    isNeverType,
    isUnresolvedType,
    isVoidType,
    NamedType,
    neverType,
    numberType,
    unresolvedType,
    resolveTyLabel,
    stringType,
    Type,
    TypeEnv,
    voidType,
    isFunctionType,
    isIncompleteType
} from './types.js';

type StatementResult = 'invalid' | 'ok' | 'return' | 'break';

export class AnalyzeResult {
    success: boolean;
    errors: string[];
    warnings: string[];
    constructor(success: boolean, errors: string[], warnings: string[]) {
        this.success = success;
        this.errors = errors;
        this.warnings = warnings;
    }
}

export function analyze(
    source: SourceFile,
    env: SymbolEnv,
    typeEnv: TypeEnv,
    symbolTable: Map<AstNode, Symbol>,
    projectInfo: ProjectInfo
): AnalyzeResult {
    const ctx = new AnalyzeContext(symbolTable, projectInfo);
    builtins.setDeclarations(env, typeEnv);

    // 1st phase: declare
    for (const node of source.decls) {
        declareTopLevel(node, ctx, env);
    }
    // 2nd phase: resolve
    for (const node of source.decls) {
        resolveTopLevel(node, ctx, env);
    }
    // 3rd phase: analyze
    for (const node of source.decls) {
        analyzeTopLevel(node, ctx, env);
    }

    if (ctx.isUsedAnyType) {
        ctx.dispatchWarn('type checking of array elements is not supported yet.');
    }

    return new AnalyzeResult((ctx.error.length == 0), ctx.error, ctx.warn);
}

function declareTopLevel(node: FileNode, ctx: AnalyzeContext, env: SymbolEnv) {
    switch (node.kind) {
        case 'FunctionDecl': {
            // check for duplicate
            if (env.get(node.name) != null) {
                ctx.dispatchError(`\`${node.name}\` is already declared.`);
                return;
            }

            // export specifier
            if (node.exported) {
                ctx.dispatchWarn('exported function is not supported yet.', node);
            }

            // make param list
            const params = node.params.map(x => ({ name: x.name }));

            // declare function
            const symbol = createFunctionSymbol(params, unresolvedType, []);
            ctx.symbolTable.set(node, symbol);
            env.set(node.name, symbol);
            break;
        }
        case 'StructDecl': {
            // check for duplicate
            if (env.get(node.name) != null) {
                ctx.dispatchError(`\`${node.name}\` is already declared.`);
                return;
            }

            // export specifier
            if (node.exported) {
                ctx.dispatchWarn('exported function is not supported yet.', node);
            }

            // make fields
            const fields = new Map<string, Symbol>();
            for (const field of node.fields) {
                const fieldSymbol = createVariableSymbol(unresolvedType, true);
                fields.set(field.name, fieldSymbol);
            }

            // declare struct
            const symbol: Symbol = createStructSymbol(node.name, fields);
            ctx.symbolTable.set(node, symbol);
            env.set(node.name, symbol);
            break;
        }
    }
}

function resolveTopLevel(node: FileNode, ctx: AnalyzeContext, env: SymbolEnv) {
    switch (node.kind) {
        case 'FunctionDecl': {
            // get symbol
            const symbol = env.get(node.name);
            if (symbol == null) {
                throw new UguisuError('symbol not found.');
            }

            // expect function symbol
            if (symbol.kind != 'FnSymbol') {
                ctx.dispatchError('function expected.', node);
                return;
            }

            // make return type
            let returnTy: Type;
            if (node.returnTy != null) {
                returnTy = resolveTyLabel(node.returnTy, ctx, env);
            } else {
                returnTy = voidType;
            }

            // make params type
            let paramsTy: Type[] = [];
            for (let i = 0; i < symbol.params.length; i++) {
                const paramNode = node.params[i];

                // if param type is not specified
                if (paramNode.ty == null) {
                    ctx.dispatchError('parameter type missing.', paramNode);
                    paramsTy.push(invalidType);
                    continue;
                }

                // get param type
                const paramTy = resolveTyLabel(paramNode.ty, ctx, env);
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
            const structSymbol = env.get(node.name);
            if (structSymbol == null) {
                throw new UguisuError('symbol not found.');
            }

            // expect struct symbol
            if (structSymbol.kind != 'StructSymbol') {
                ctx.dispatchError('struct expected.', node);
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
                fieldSymbol.ty = resolveTyLabel(field.ty, ctx, env);
            }
            break;
        }
    }
}

function analyzeTopLevel(node: FileNode, ctx: AnalyzeContext, env: SymbolEnv) {
    switch (node.kind) {
        case 'FunctionDecl': {
            // get function symbol
            const symbol = env.get(node.name);
            if (symbol == null) {
                throw new UguisuError('symbol not found.');
            }

            // expect function symbol
            if (symbol.kind != 'FnSymbol') {
                ctx.dispatchError('function expected.', node);
                return;
            }

            // check the function type is valid
            if (isIncompleteType(symbol.ty)) {
                if (isUnresolvedType(symbol.ty)) {
                    ctx.dispatchError('function is not defined yet.', node);
                }
                return;
            }
            const fnType = symbol.ty;

            const beforeAnalyzeBlock = () => {
                // set function params to the env
                for (let i = 0; i < node.params.length; i++) {
                    const paramSymbol = createVariableSymbol(fnType.fnParamTypes[i], true);
                    ctx.symbolTable.set(node.params[i], paramSymbol);
                    env.set(node.params[i].name, paramSymbol);
                }
            }

            // analyze function body
            const ty = analyzeBlock(node.body, false, symbol, ctx, env, beforeAnalyzeBlock);

            // check return type
            if (!isNeverType(ty)) {
                if (compareType(ty, symbol.ty.fnReturnType) == 'incompatible') {
                    dispatchTypeError(ty, symbol.ty.fnReturnType, node, ctx);
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
function analyzeBlock(nodes: StepNode[], allowJump: boolean, funcSymbol: FnSymbol, ctx: AnalyzeContext, env: SymbolEnv, before?: () => void): Type {
    if (isIncompleteType(funcSymbol.ty)) {
        throw new UguisuError('unexpected type');
    }

    env.enter();

    if (before != null) {
        before();
    }

    let blockTy: Type = voidType;

    // analyze inner
    for (let i = 0; i < nodes.length; i++) {
        const step = nodes[i];

        let ty;
        if (isExprNode(step)) {
            ty = analyzeExpr(step, allowJump, funcSymbol, ctx, env);
        } else {
            const result = analyzeStatement(step, allowJump, funcSymbol, ctx, env);
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
                dispatchTypeError(ty, voidType, step, ctx);
            }
        }
    }

    env.leave();

    return blockTy;
}

function analyzeReferenceExpr(node: ReferenceExpr, allowJump: boolean, funcSymbol: FnSymbol, ctx: AnalyzeContext, env: SymbolEnv): Symbol | undefined {
    switch (node.kind) {
        case 'Identifier': {
            // get symbol
            const symbol = env.get(node.name);

            if (symbol == null) {
                ctx.dispatchError('unknown identifier.', node);
                return undefined;
            }

            return symbol;
        }
        case 'FieldAccess': {
            // analyze target
            const targetTy = analyzeExpr(node.target, allowJump, funcSymbol, ctx, env);

            if (isIncompleteType(targetTy)) {
                if (isUnresolvedType(targetTy)) {
                    ctx.dispatchError('variable is not assigned yet.', node.target);
                }
                return undefined;
            }

            switch (targetTy.kind) {
                case 'NamedType': {
                    if (targetTy.typeParams.length > 0) {
                        throw new UguisuError('not implemented yet.'); // TODO
                    }

                    // get target symbol
                    const symbol = env.get(targetTy.name);
                    if (symbol == null) {
                        ctx.dispatchError('unknown identifier.', node.target);
                        return undefined;
                    }

                    if (symbol.kind == 'StructSymbol') {
                        // get field symbol
                        const field = symbol.fields.get(node.name);

                        // if specified field name is invalid
                        if (field == null) {
                            ctx.dispatchError('unknown field name.', node);
                            return undefined;
                        }

                        return field;
                    } else {
                        ctx.dispatchError('invalid field access.', node);
                        return undefined;
                    }
                    break;
                }
                case 'AnyType': {
                    // TODO: Ensure that the type `any` is handled correctly.
                    return undefined;
                }
                case 'FunctionType':
                case 'VoidType': {
                    ctx.dispatchError('invalid field access');
                    return undefined;
                }
            }
            break;
        }
        case 'IndexAccess': {
            const targetTy = analyzeExpr(node.target, allowJump, funcSymbol, ctx, env);
            const indexTy = analyzeExpr(node.index, allowJump, funcSymbol, ctx, env);

            // check target type
            if (compareType(targetTy, arrayType) == 'incompatible') {
                dispatchTypeError(targetTy, arrayType, node.target, ctx);
                return undefined;
            }

            // check index type
            if (!checkIfIndexSupported(indexTy, node.index, ctx)) {
                return undefined;
            }

            if (isIncompleteType(targetTy)) {
                if (isUnresolvedType(targetTy)) {
                    ctx.dispatchError('variable is not assigned yet.', node.target);
                }
                return undefined;
            }

            if (isIncompleteType(indexTy)) {
                if (isUnresolvedType(indexTy)) {
                    ctx.dispatchError('variable is not assigned yet.', node.index);
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

function analyzeStatement(node: StatementNode, allowJump: boolean, funcSymbol: FnSymbol, ctx: AnalyzeContext, env: SymbolEnv): StatementResult {
    switch (node.kind) {
        case 'ExprStatement': {
            analyzeExpr(node.expr, allowJump, funcSymbol, ctx, env);
            return 'ok';
        }
        case 'ReturnStatement': {
            // if there is a return value
            if (node.expr != null) {
                let ty = analyzeExpr(node.expr, allowJump, funcSymbol, ctx, env);

                // if the expr returned nothing
                if (isVoidType(ty)) {
                    ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                    ty = invalidType;
                }

                if (isIncompleteType(funcSymbol.ty)) {
                    if (isUnresolvedType(funcSymbol.ty)) {
                        throw new UguisuError('unexpected type');
                    }
                    return 'invalid';
                }

                // check type
                if (compareType(ty, funcSymbol.ty.fnReturnType) == 'incompatible') {
                    dispatchTypeError(ty, funcSymbol.ty.fnReturnType, node.expr, ctx);
                    return 'invalid';
                }
            }
            return 'return';
        }
        case 'BreakStatement': {
            // if there is no associated loop
            if (!allowJump) {
                ctx.dispatchError('invalid break statement.');
                return 'invalid';
            }
            return 'break';
        }
        case 'LoopStatement': {
            // allow break
            allowJump = true;

            const ty = analyzeBlock(node.block, allowJump, funcSymbol, ctx, env);

            // check block
            if (compareType(ty, voidType) == 'incompatible') {
                dispatchTypeError(ty, voidType, node, ctx);
            }
            return 'ok';
        }
        case 'VariableDecl': {
            let isDefined = false;
            let ty: Type = unresolvedType;

            // if an explicit type is specified
            if (node.ty != null) {
                ty = resolveTyLabel(node.ty, ctx, env);
            }

            // initializer
            if (node.body != null) {
                let bodyTy = analyzeExpr(node.body, allowJump, funcSymbol, ctx, env);

                // if the initializer returns nothing
                if (isVoidType(bodyTy)) {
                    ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                    bodyTy = invalidType;
                }

                // if the variable type is not decided
                if (isUnresolvedType(ty)) {
                    ty = bodyTy;
                }

                // check type
                if (compareType(bodyTy, ty) == 'incompatible') {
                    dispatchTypeError(bodyTy, ty, node.body, ctx);
                }

                isDefined = true;
            }

            // set symbol
            const symbol = createVariableSymbol(ty, isDefined);
            ctx.symbolTable.set(node, symbol);
            env.set(node.name, symbol);

            return 'ok';
        }
        case 'AssignStatement': {
            let bodyTy = analyzeExpr(node.body, allowJump, funcSymbol, ctx, env);

            // if the body returns nothing
            if (isVoidType(bodyTy)) {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                bodyTy = invalidType;
            }

            // analyze target
            let symbol;
            if (node.target.kind == 'Identifier' || node.target.kind == 'FieldAccess' || node.target.kind == 'IndexAccess') {
                symbol = analyzeReferenceExpr(node.target, allowJump, funcSymbol, ctx, env);
            } else {
                ctx.dispatchError('invalid assign target.');
            }

            // skip if target symbol is invalid
            if (symbol == null) {
                return 'invalid';
            }

            let targetTy = getTypeFromSymbol(symbol);

            // if it was the first assignment
            if (symbol.kind == 'VariableSymbol' && !symbol.isDefined) {
                // if need inference
                if (isUnresolvedType(targetTy)) {
                    targetTy = bodyTy;
                    symbol.ty = targetTy;
                }
                symbol.isDefined = true;
            }

            // check type
            switch (node.mode) {
                case '=': {
                    if (compareType(bodyTy, targetTy) == 'incompatible') {
                        dispatchTypeError(bodyTy, targetTy, node.body, ctx);
                    }
                    break;
                }
                case '+=':
                case '-=':
                case '*=':
                case '/=':
                case '%=': {
                    checkIfArithOpsSupported(targetTy, node.target, ctx);
                    checkIfArithOpsSupported(bodyTy, node.body, ctx);
                    break;
                }
            }
            return 'ok';
        }
    }
    throw new UguisuError('unexpected node');
}

function analyzeExpr(node: ExprNode, allowJump: boolean, funcSymbol: FnSymbol, ctx: AnalyzeContext, env: SymbolEnv): Type {
    // validate expression
    switch (node.kind) {
        case 'Identifier':
        case 'FieldAccess':
        case 'IndexAccess': {
            const symbol = analyzeReferenceExpr(node, allowJump, funcSymbol, ctx, env);
            if (symbol == null) {
                return invalidType;
            }

            // get expr type from the symbol
            const ty = getTypeFromSymbol(symbol);

            // if the variable is not assigned
            if (symbol.kind == 'VariableSymbol' && !symbol.isDefined) {
                ctx.dispatchError('variable is not assigned yet.', node);
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
                ctx.dispatchError('invalid char literal.', node);
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
                calleeSymbol = analyzeReferenceExpr(node.callee, allowJump, funcSymbol, ctx, env);
            } else {
                ctx.dispatchError('invalid callee.');
            }

            if (calleeSymbol == null) {
                return invalidType;
            }

            ctx.symbolTable.set(node.callee, calleeSymbol);

            // check callable
            let calleeTy;
            switch (calleeSymbol.kind) {
                case 'FnSymbol':
                case 'NativeFnSymbol': {
                    calleeTy = calleeSymbol.ty;
                    break;
                }
                case 'StructSymbol': {
                    ctx.dispatchError('struct is not callable.', node.callee);
                    return invalidType;
                }
                case 'VariableSymbol': {
                    // if the variable is not assigned
                    if (isUnresolvedType(calleeSymbol.ty)) {
                        ctx.dispatchError('variable is not assigned yet.', node.callee);
                        return invalidType;
                    }

                    if (isIncompleteType(calleeSymbol.ty)) {
                        return invalidType;
                    }

                    // expect function
                    if (!isFunctionType(calleeSymbol.ty)) {
                        ctx.dispatchError(`type mismatched. expected function, found \`${getTypeString(calleeSymbol.ty)}\``, node.callee);
                        return invalidType;
                    }

                    calleeTy = calleeSymbol.ty;
                    break;
                }
                case 'ExprSymbol': {
                    throw new UguisuError('unexpected symbol');
                }
            }

            if (isIncompleteType(calleeTy)) {
                if (isUnresolvedType(calleeTy)) {
                    ctx.dispatchError('callee is not assigned yet.', node.callee);
                }
                return invalidType;
            }

            let isCorrectArgCount = true;
            if (node.args.length != calleeTy.fnParamTypes.length) {
                ctx.dispatchError('argument count incorrect.', node);
                isCorrectArgCount = false;
            }

            if (isCorrectArgCount) {
                for (let i = 0; i < calleeTy.fnParamTypes.length; i++) {
                    let argTy = analyzeExpr(node.args[i], allowJump, funcSymbol, ctx, env);

                    if (isUnresolvedType(argTy)) {
                        ctx.dispatchError('variable is not assigned yet.', node.args[i]);
                        argTy = invalidType;
                    }

                    // if the argument returns nothing
                    if (isVoidType(argTy)) {
                        ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.args[i]);
                        argTy = invalidType;
                    }

                    const paramTy = calleeTy.fnParamTypes[i];

                    if (isIncompleteType(argTy) || isIncompleteType(paramTy)) {
                        continue;
                    }

                    if (compareType(argTy, paramTy) == 'incompatible') {
                        dispatchTypeError(argTy, paramTy, node.args[i], ctx);
                    }
                }
            }

            ctx.symbolTable.set(node, createExprSymbol(calleeTy.fnReturnType));
            return calleeTy.fnReturnType;
        }
        case 'BinaryOp': {
            let leftTy = analyzeExpr(node.left, allowJump, funcSymbol, ctx, env);
            let rightTy = analyzeExpr(node.right, allowJump, funcSymbol, ctx, env);

            // check assigned
            if (isUnresolvedType(leftTy)) {
                ctx.dispatchError('variable is not assigned yet.', node.left);
                leftTy = invalidType;
            }
            if (isUnresolvedType(rightTy)) {
                ctx.dispatchError('variable is not assigned yet.', node.right);
                rightTy = invalidType;
            }

            // if the expr returns nothing
            if (isVoidType(leftTy)) {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.left);
                leftTy = invalidType;
            }
            if (isVoidType(rightTy)) {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.right);
                rightTy = invalidType;
            }

            if (isIncompleteType(leftTy) || isIncompleteType(rightTy)) {
                return invalidType;
            }

            if (isLogicalBinaryOperator(node.operator)) {
                // Logical Operation
                if (!checkIfLogicalOpsSupported(leftTy, node.left, ctx)) {
                    return invalidType;
                }
                if (!checkIfLogicalOpsSupported(rightTy, node.right, ctx)) {
                    return invalidType;
                }

                if (compareType(rightTy, leftTy) == 'incompatible') {
                    dispatchTypeError(rightTy, leftTy, node.right, ctx);
                    return invalidType;
                }

                ctx.symbolTable.set(node, createExprSymbol(leftTy));
                return leftTy;
            } else if (isEquivalentOperator(node.operator)) {
                // Equivalent Operation
                if (compareType(rightTy, leftTy) == 'incompatible') {
                    dispatchTypeError(rightTy, leftTy, node.right, ctx);
                    return invalidType;
                }

                ctx.symbolTable.set(node, createExprSymbol(boolType));
                return boolType;
            } else if (isOrderingOperator(node.operator)) {
                // Ordering Operation
                checkIfOrderOpsSupported(leftTy, node.left, ctx);
                checkIfOrderOpsSupported(rightTy, node.right, ctx);

                if (compareType(rightTy, leftTy) == 'incompatible') {
                    dispatchTypeError(rightTy, leftTy, node.right, ctx);
                    return invalidType;
                }

                ctx.symbolTable.set(node, createExprSymbol(boolType));
                return boolType;
            } else {
                // Arithmetic Operation
                checkIfArithOpsSupported(leftTy, node.left, ctx);
                checkIfArithOpsSupported(rightTy, node.right, ctx);

                if (compareType(rightTy, leftTy) == 'incompatible') {
                    dispatchTypeError(rightTy, leftTy, node.right, ctx);
                    return invalidType;
                }

                ctx.symbolTable.set(node, createExprSymbol(leftTy));
                return leftTy;
            }
            break;
        }
        case 'UnaryOp': {
            let ty = analyzeExpr(node.expr, allowJump, funcSymbol, ctx, env);

            // check assigned
            if (isUnresolvedType(ty)) {
                ctx.dispatchError('variable is not assigned yet.', node.expr);
                ty = invalidType;
            }

            // if the expr returns nothing
            if (isVoidType(ty)) {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                ty = invalidType;
            }

            if (isIncompleteType(ty)) {
                return invalidType;
            }

            // Logical Operation
            if (!checkIfLogicalOpsSupported(ty, node, ctx)) {
                return invalidType;
            }
            ctx.symbolTable.set(node, createExprSymbol(ty));
            return ty;
        }
        case 'StructExpr': {
            // get symbol
            const symbol = env.get(node.name);
            if (symbol == null) {
                ctx.dispatchError('unknown identifier.', node);
                return invalidType;
            }

            // expect struct symbol
            if (symbol.kind != 'StructSymbol') {
                ctx.dispatchError('struct expected.', node);
                return invalidType;
            }

            const defined: string[] = [];
            for (const fieldNode of node.fields) {
                // check already defined
                if (defined.indexOf(fieldNode.name) != -1) {
                    ctx.dispatchError(`field \`${fieldNode.name}\` is duplicated.`, fieldNode);
                }
                defined.push(fieldNode.name);

                // analyze field
                let bodyTy = analyzeExpr(fieldNode.body, allowJump, funcSymbol, ctx, env);

                // TODO: check pending?

                // if the expr returns nothing
                if (isVoidType(bodyTy)) {
                    ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, fieldNode.body);
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
                    dispatchTypeError(bodyTy, fieldSymbol.ty, fieldNode.body, ctx);
                }
            }

            // check fields are all defined
            for (const [name, _field] of symbol.fields) {
                if (!defined.includes(name)) {
                    ctx.dispatchError(`field \`${name}\` is not initialized.`, node);
                }
            }

            return new NamedType(symbol.name);
        }
        case 'ArrayNode': {
            // analyze elements
            for (const item of node.items) {
                analyzeExpr(item, allowJump, funcSymbol, ctx, env);

                // TODO: check type
            }

            // return expr type
            return arrayType;
        }
        case 'IfExpr': {
            let condTy = analyzeExpr(node.cond, allowJump, funcSymbol, ctx, env);
            const thenTy = analyzeBlock(node.thenBlock, allowJump, funcSymbol, ctx, env);
            const elseTy = analyzeBlock(node.elseBlock, allowJump, funcSymbol, ctx, env);

            // if the condition expr returned nothing
            if (isVoidType(condTy)) {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.cond);
                condTy = invalidType;
            }

            // check cond
            if (compareType(condTy, boolType) == 'incompatible') {
                dispatchTypeError(condTy, boolType, node.cond, ctx);
            }

            // check blocks
            if (!isNeverType(thenTy) && isNeverType(elseTy)) {
                return thenTy;
            }
            if (isNeverType(thenTy) && !isNeverType(elseTy)) {
                return elseTy;
            }
            if (compareType(elseTy, thenTy) == 'incompatible') {
                dispatchTypeError(elseTy, thenTy, node, ctx);
                return invalidType;
            }

            return thenTy;
        }
    }
    throw new UguisuError('unexpected node');
}
