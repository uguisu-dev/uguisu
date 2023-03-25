import { UguisuError } from '../misc/errors.js';
import { ProjectInfo } from '../project-file.js';
import {
    AstNode,
    FileNode,
    isEquivalentOperator,
    isLogicalBinaryOperator,
    isOrderingOperator,
    SourceFile,
    StatementNode,
    TyLabel
} from '../syntax/tools.js';
import * as builtins from './builtins.js';
import {
    AnalyzeContext,
    AnalysisEnv,
    FunctionSymbol,
    Symbol,
    VariableSymbol,
    Type,
    voidType,
    badType,
    newFunctionType,
    pendingType,
    compareType,
    dispatchTypeError,
    numberType,
    boolType,
    stringType,
    isValidType,
    getTypeString,
    newSimpleType,
    newFunctionSymbol,
} from './tools.js';

export function analyze(
    source: SourceFile,
    env: AnalysisEnv,
    symbolTable: Map<AstNode, Symbol>,
    projectInfo: ProjectInfo
): boolean {
    const a = new AnalyzeContext(env, symbolTable, projectInfo);
    builtins.setDeclarations(a);

    for (const decl of source.decls) {
        collectDecl(a, decl);
    }
    for (const decl of source.decls) {
        resolveFileNodeType(a, decl);
    }

    for (const decl of source.decls) {
        checkInfinityNest(a, newSimpleType(decl.name), []);
        checkFuncBody(a, decl);
    }

    // print errors
    for (const message of a.error) {
        console.log(`Syntax Error: ${message}`);
    }
    for (const warn of a.warn) {
        console.log(`Warning: ${warn}`);
    }

    return (a.error.length == 0);
}

// collect names
function collectDecl(a: AnalyzeContext, node: FileNode) {
    switch (node.kind) {
        case 'FunctionDecl': {
            if (a.env.get(node.name) != null) {
                a.dispatchError(`identifier \`${node.name}\` is already declared.`);
                return;
            }

            // export specifier
            if (node.exported) {
                a.dispatchWarn('exported function is not supported yet.', node);
            }

            const params = node.params.map(x => ({ name: x.name }));
            const vars = node.params.map(x => ({ name: x.name, isParam: true, ty: pendingType }));
            const symbol = newFunctionSymbol(params,  pendingType, vars);
            a.symbolTable.set(node, symbol);
            a.env.set(node.name, symbol);
            break;
        }
        case 'StructDecl': {
            if (a.env.get(node.name) != null) {
                a.dispatchError(`identifier \`${node.name}\` is already declared.`);
                return;
            }

            // export specifier
            if (node.exported) {
                a.dispatchWarn('`export` keyword is not supported for a struct.', node);
            }

            const fields = new Map<string, { ty: Type }>();
            for (const field of node.fields) {
                fields.set(field.name, { ty: pendingType });
            }
            const symbol: Symbol = { kind: 'StructSymbol', fields };
            a.symbolTable.set(node, symbol);
            a.env.set(node.name, symbol);
            break;
        }
    }
}

function resolveFileNodeType(a: AnalyzeContext, node: FileNode) {
    switch (node.kind) {
        case 'FunctionDecl': {
            const symbol = a.env.get(node.name);
            if (symbol == null) {
                throw new Error('symbol not found.');
            }
            if (symbol.kind != 'FnSymbol') {
                a.dispatchError('function expected.', node);
                return;
            }
            // resolve type
            if (symbol.ty.kind == 'PendingType') {
                let returnType: Type;
                if (node.returnTy != null) {
                    returnType = resolveTypeName(a, node.returnTy);
                } else {
                    returnType = voidType;
                }
                let paramTypes: Type[] = [];
                for (let i = 0; i < symbol.params.length; i++) {
                    const paramNode = node.params[i];
                    // invalid parameter
                    if (paramNode.ty == null) {
                        a.dispatchError('parameter type missing.', paramNode);
                        paramTypes.push(badType);
                        continue;
                    }
                    const paramType = resolveTypeName(a, paramNode.ty);
                    paramTypes.push(paramType);
                }
                symbol.ty = newFunctionType(paramTypes, returnType);
                for (let i = 0; i < symbol.params.length; i++) {
                    symbol.vars[i].ty = paramTypes[i];
                }
            }
            break;
        }
        case 'StructDecl': {
            const symbol = a.env.get(node.name);
            if (symbol == null) {
                throw new Error('symbol not found.');
            }
            if (symbol.kind != 'StructSymbol') {
                a.dispatchError('struct expected.', node);
                return;
            }
            for (const field of node.fields) {
                // resolve type
                const info = symbol.fields.get(field.name)!;
                if (info.ty.kind == 'PendingType') {
                    info.ty = resolveTypeName(a, field.ty);
                    symbol.fields.set(field.name, info);
                }
            }
            break;
        }
    }
}

function checkInfinityNest(a: AnalyzeContext, ty: Type, path: Type[]) {
    if (ty.kind == 'SimpleType') {
        if (path.find(x => compareType(x, ty) == 'compatible') != null) {
            a.dispatchError('struct loop is detected.');
            return;
        }
        const nextPath = [...path, ty];
        const symbol = a.env.get(ty.name);
        if (symbol == null || symbol.kind != 'StructSymbol') {
            return;
        }
        for (const [_key, field] of symbol.fields) {
            checkInfinityNest(a, field.ty, nextPath);
        }
    }
}

function checkFuncBody(a: AnalyzeContext, node: FileNode) {
    if (node.kind != 'FunctionDecl') {
        return;
    }
    // define function
    const symbol = a.env.get(node.name);
    if (symbol == null) {
        a.dispatchError('undefined symbol.', node);
        return;
    }
    if (symbol.kind != 'FnSymbol') {
        a.dispatchError('function expected.', node);
        return;
    }
    if (!isValidType(symbol.ty)) {
        return;
    }
    a.env.enter();
    for (let i = 0; i < node.params.length; i++) {
        const paramSymbol: VariableSymbol = {
            kind: 'VariableSymbol',
            ty: symbol.ty.paramTypes[i],
        };
        a.symbolTable.set(node.params[i], paramSymbol);
        a.env.set(node.params[i].name, paramSymbol);
    }
    for (const statement of node.body) {
        validateStatement(a, statement, false, symbol);
    }
    a.env.leave();
}

function validateStatement(a: AnalyzeContext, node: StatementNode, allowJump: boolean, funcSymbol: FunctionSymbol) {
    switch (node.kind) {
        case 'VariableDecl': {
            // specified type
            let ty: Type;
            if (node.ty != null) {
                ty = resolveTypeName(a, node.ty);
            } else {
                ty = pendingType;
            }
            // if it has an initial value
            if (node.body != null) {
                let bodyTy = inferType(a, node.body, funcSymbol);
                // if the body returns nothing
                if (compareType(bodyTy, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                    bodyTy = badType;
                }
                if (ty.kind == 'PendingType') {
                    ty = bodyTy;
                } else {
                    if (compareType(ty, bodyTy) == 'incompatible') {
                        dispatchTypeError(a, bodyTy, ty, node.body);
                    }
                }
            }
            const symbol: VariableSymbol = {
                kind: 'VariableSymbol',
                ty,
            };
            a.symbolTable.set(node, symbol);
            a.env.set(node.name, symbol);

            funcSymbol.vars.push({
                name: node.name,
                isParam: false,
                ty,
            });
            return;
        }
        case 'AssignStatement': {
            let leftTy;
            if (node.target.kind == 'Identifier' || node.target.kind == 'FieldAccess') {
                leftTy = inferType(a, node.target, funcSymbol);
            } else {
                a.dispatchError('invalid target.');
                leftTy = badType;
            }
            let bodyTy = inferType(a, node.body, funcSymbol);
            // if the body returns nothing
            if (compareType(bodyTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                bodyTy = badType;
            }
            if (node.target.kind == 'Identifier') {
                // if it was the first assignment
                if (leftTy.kind == 'PendingType') {
                    leftTy = bodyTy;
                    const target = node.target;
                    const variable = funcSymbol.vars.find(x => x.name == target.name);
                    if (variable == null) {
                        throw new UguisuError('variable not found');
                    }
                    variable.ty = bodyTy;
                }
            }

            switch (node.mode) {
                case '=': {
                    if (compareType(bodyTy, leftTy) == 'incompatible') {
                        dispatchTypeError(a, bodyTy, leftTy, node.body);
                    }
                    break;
                }
                case '+=':
                case '-=':
                case '*=':
                case '/=':
                case '%=': {
                    if (compareType(leftTy, numberType) == 'incompatible') {
                        dispatchTypeError(a, leftTy, numberType, node.target);
                    }
                    if (compareType(bodyTy, numberType) == 'incompatible') {
                        dispatchTypeError(a, bodyTy, numberType, node.body);
                    }
                    break;
                }
            }

            return;
        }
        case 'IfStatement': {
            let condTy = inferType(a, node.cond, funcSymbol);
            // if the condition returns nothing
            if (compareType(condTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.cond);
                condTy = badType;
            }
            if (compareType(condTy, boolType) == 'incompatible') {
                dispatchTypeError(a, condTy, boolType, node.cond);
            }
            validateBlock(a, node.thenBlock, allowJump, funcSymbol);
            validateBlock(a, node.elseBlock, allowJump, funcSymbol);
            return;
        }
        case 'LoopStatement': {
            validateBlock(a, node.block, true, funcSymbol);
            return;
        }
        case 'ReturnStatement': {
            if (node.expr != null) {
                let ty = inferType(a, node.expr, funcSymbol);
                // if the expr returns nothing
                if (compareType(ty, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                    ty = badType;
                }
                if (isValidType(funcSymbol.ty)) {
                    if (compareType(ty, funcSymbol.ty.returnType) == 'incompatible') {
                        dispatchTypeError(a, ty, funcSymbol.ty.returnType, node.expr);
                    }
                }
            }
            return;
        }
        case 'BreakStatement': {
            if (!allowJump) {
                a.dispatchError('invalid break statement');
            }
            return;
        }
        case 'NumberLiteral':
        case 'BoolLiteral':
        case 'StringLiteral':
        case 'BinaryOp':
        case 'UnaryOp':
        case 'Identifier':
        case 'Call':
        case 'StructExpr':
        case 'FieldAccess': {
            inferType(a, node, funcSymbol);
            return;
        }
    }
    throw new UguisuError('unexpected node.');
}

function validateBlock(
    a: AnalyzeContext,
    block: StatementNode[],
    allowJump: boolean,
    funcSymbol: FunctionSymbol
) {
    a.env.enter();
    for (const statement of block) {
        validateStatement(a, statement, allowJump, funcSymbol);
    }
    a.env.leave();
}

function inferType(a: AnalyzeContext, node: AstNode, funcSymbol: FunctionSymbol): Type {
    switch (node.kind) {
        case 'NumberLiteral': {
            return numberType;
        }
        case 'BoolLiteral': {
            return boolType;
        }
        case 'StringLiteral': {
            return stringType;
        }
        case 'BinaryOp': {
            let leftTy = inferType(a, node.left, funcSymbol);
            let rightTy = inferType(a, node.right, funcSymbol);
            // if the left expr returns nothing
            if (compareType(leftTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.left);
                leftTy = badType;
            }
            // if the right expr returns nothing
            if (compareType(rightTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.right);
                rightTy = badType;
            }
            if (isLogicalBinaryOperator(node.operator)) {
                // Logical Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    if (compareType(leftTy, boolType) == 'incompatible') {
                        dispatchTypeError(a, leftTy, boolType, node.left);
                    }
                    if (compareType(rightTy, boolType) == 'incompatible') {
                        dispatchTypeError(a, rightTy, boolType, node.right);
                    }
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: boolType });
                    return boolType;
                } else {
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: badType });
                    return badType;
                }
            } else if (isEquivalentOperator(node.operator)) {
                // Equivalent Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    if (compareType(rightTy, leftTy) == 'incompatible') {
                        dispatchTypeError(a, rightTy, leftTy, node.right);
                    }
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: boolType });
                    return boolType;
                } else {
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: badType });
                    return badType;
                }
            } else if (isOrderingOperator(node.operator)) {
                // Ordering Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    if (compareType(leftTy, numberType) == 'incompatible') {
                        dispatchTypeError(a, leftTy, numberType, node.left);
                    }
                    if (compareType(rightTy, numberType) == 'incompatible') {
                        dispatchTypeError(a, rightTy, numberType, node.right);
                    }
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: boolType });
                    return boolType;
                } else {
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: badType });
                    return badType;
                }
            } else {
                // Arithmetic Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    if (compareType(leftTy, numberType) == 'incompatible') {
                        dispatchTypeError(a, leftTy, numberType, node.left);
                    }
                    if (compareType(rightTy, numberType) == 'incompatible') {
                        dispatchTypeError(a, rightTy, numberType, node.right);
                    }
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: numberType });
                    return numberType;
                } else {
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: badType });
                    return badType;
                }
            }
            break;
        }
        case 'UnaryOp': {
            let ty = inferType(a, node.expr, funcSymbol);
            // if the expr returns nothing
            if (compareType(ty, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                ty = badType;
            }
            // Logical Operation
            if (isValidType(ty)) {
                if (compareType(ty, boolType) == 'incompatible') {
                    dispatchTypeError(a, ty, boolType, node);
                }
                a.symbolTable.set(node, { kind: 'ExprSymbol', ty: boolType });
                return boolType;
            } else {
                a.symbolTable.set(node, { kind: 'ExprSymbol', ty: badType });
                return badType;
            }
            break;
        }
        case 'Identifier': {
            if (node.kind != 'Identifier') {
                a.dispatchError('identifier expected.', node);
                return badType;
            }
            const symbol = a.env.get(node.name);
            if (symbol == null) {
                a.dispatchError('unknown identifier.', node);
                return badType;
            }
            a.symbolTable.set(node, symbol);
            switch (symbol.kind) {
                case 'FnSymbol':
                case 'NativeFnSymbol': {
                    return symbol.ty;
                }
                case 'StructSymbol': {
                    return newSimpleType(node.name);
                }
                case 'VariableSymbol': {
                    // if the variable is not assigned
                    if (symbol.ty.kind == 'PendingType') {
                        a.dispatchError('variable is not assigned yet.', node);
                        return badType;
                    }
                    return symbol.ty;
                }
                case 'ExprSymbol': {
                    throw new UguisuError('unexpected symbol');
                }
            }
            break;
        }
        case 'Call': {
            if (node.callee.kind != 'Identifier') {
                a.dispatchError('identifier expected.', node.callee);
                return badType;
            }
            const calleeSymbol = a.env.get(node.callee.name);
            if (calleeSymbol == null) {
                a.dispatchError('unknown identifier.', node.callee);
                return badType;
            }
            a.symbolTable.set(node.callee, calleeSymbol);
            switch (calleeSymbol.kind) {
                case 'FnSymbol':
                case 'NativeFnSymbol': {
                    break;
                }
                case 'StructSymbol': {
                    a.dispatchError('struct is not callable.', node.callee);
                    return badType;
                }
                case 'VariableSymbol': {
                    // if the variable is not assigned
                    if (calleeSymbol.ty.kind == 'PendingType') {
                        a.dispatchError('variable is not assigned yet.', node.callee);
                        return badType;
                    }
                    if (calleeSymbol.ty.kind != 'FunctionType') {
                        a.dispatchError(`type mismatched. expected function, found \`${getTypeString(calleeSymbol.ty)}\``, node.callee);
                    }
                    // TODO
                    a.dispatchError('type check for a function variable is not supported.', node.callee);
                    return badType;
                }
                case 'ExprSymbol': {
                    throw new UguisuError('unexpected symbol');
                }
            }
            if (node.args.length == calleeSymbol.params.length) {
                for (let i = 0; i < calleeSymbol.params.length; i++) {
                    let argTy = inferType(a, node.args[i], funcSymbol);
                    // if the argument returns nothing
                    if (compareType(argTy, voidType) == 'compatible') {
                        a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.args[i]);
                        argTy = badType;
                    }
                    if (isValidType(calleeSymbol.ty)) {
                        const paramTy = calleeSymbol.ty.paramTypes[i];
                        if (isValidType(argTy) && isValidType(paramTy)) {
                            if (compareType(argTy, paramTy) == 'incompatible') {
                                dispatchTypeError(a, argTy, paramTy, node.args[i]);
                            }
                        }
                    }
                }
            } else {
                a.dispatchError('argument count incorrect.', node);
            }
            if (isValidType(calleeSymbol.ty)) {
                a.symbolTable.set(node, { kind: 'ExprSymbol', ty: calleeSymbol.ty.returnType });
                return calleeSymbol.ty.returnType;
            } else {
                return badType;
            }
        }
        case 'StructExpr': {
            const symbol = a.env.get(node.name);
            if (symbol == null) {
                a.dispatchError('unknown identifier.', node);
                return badType;
            }
            if (symbol.kind != 'StructSymbol') {
                a.dispatchError('struct expected.', node);
                return badType;
            }
            const defined: string[] = [];
            for (const fieldNode of node.fields) {
                if (defined.indexOf(fieldNode.name) != -1) {
                    a.dispatchError(`field \`${fieldNode.name}\` is duplicated.`, fieldNode);
                } else {
                    defined.push(fieldNode.name);
                }
                // check type
                let bodyTy = inferType(a, fieldNode.body, funcSymbol);
                // if the expr returns nothing
                if (compareType(bodyTy, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, fieldNode.body);
                    bodyTy = badType;
                }
                if (isValidType(bodyTy)) {
                    const field = symbol.fields.get(fieldNode.name)!;
                    if (compareType(bodyTy, field.ty) == 'incompatible') {
                        dispatchTypeError(a, bodyTy, field.ty, fieldNode.body);
                    }
                }
            }
            // check fields are all defined
            for (const [name, _field] of symbol.fields) {
                if (!defined.includes(name)) {
                    a.dispatchError(`field \`${name}\` is not initialized.`, node);
                }
            }
            return newSimpleType(node.name);
        }
        case 'FieldAccess': {
            const targetTy = inferType(a, node.target, funcSymbol);
            if (!isValidType(targetTy)) {
                return badType;
            }
            switch (targetTy.kind) {
                case 'SimpleType': {
                    // lookup target
                    const symbol = a.env.get(targetTy.name)!;
                    if (symbol.kind != 'StructSymbol') {
                        a.dispatchError('struct expected.', node);
                        return badType;
                    }
                    const field = symbol.fields.get(node.name);
                    if (field == null) {
                        a.dispatchError('unknown field name.', node);
                        return badType;
                    }
                    return field.ty;
                }
                case 'FunctionType':
                case 'GenericType': {
                    throw new UguisuError('not implemented yet.'); // TODO
                }
            }
            break;
        }
    }
    throw new UguisuError('unexpected node.');
}

function resolveTypeName(a: AnalyzeContext, node: TyLabel): Type {
    switch (node.name) {
        case 'number':
        case 'bool':
        case 'string': {
            return newSimpleType(node.name);
        }
    }
    const symbol = a.env.get(node.name);
    if (symbol == null) {
        a.dispatchError('unknown type name.', node);
        return badType;
    }
    switch (symbol.kind) {
        case 'StructSymbol': {
            return newSimpleType(node.name);
        }
        case 'FnSymbol':
        case 'NativeFnSymbol':
        case 'VariableSymbol':
        case 'ExprSymbol': {
            a.dispatchError('unknown type name.', node);
            return badType;
        }
    }
}
