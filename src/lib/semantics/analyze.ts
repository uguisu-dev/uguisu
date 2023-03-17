import { UguisuError } from '../misc/errors.js';
import { ProjectInfo } from '../project-file.js';
import {
    AstNode,
    FileNode,
    FunctionDecl,
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
    FnVar,
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
    newStructSymbol,
} from './tools.js';

export function analyze(
    source: SourceFile,
    env: AnalysisEnv,
    symbolTable: Map<AstNode, Symbol>,
    projectInfo: ProjectInfo
): boolean {
    const a = new AnalyzeContext(env, symbolTable, projectInfo);
    builtins.setDeclarations(a);
    for (const decl of source.funcs) {
        setDeclaration(a, decl);
    }
    for (const decl of source.structs) {
        setDeclaration(a, decl);
    }
    for (const func of source.funcs) {
        validateFunc(a, func);
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

function setDeclaration(a: AnalyzeContext, node: FileNode) {
    switch (node.kind) {
        case 'FunctionDecl': { // declare function
            const vars: FnVar[] = [];

            // params
            const params: { name: string }[] = [];
            for (const param of node.params) {
                params.push({ name: param.name });
            }

            // type
            let returnTy: Type;
            if (node.returnTy != null) {
                returnTy = resolveTypeName(a, node.returnTy);
            } else {
                returnTy = voidType;
            }
            let paramTypes: Type[] = [];
            for (const param of node.params) {
                // invalid parameter
                if (param.ty == null) {
                    a.dispatchError('parameter type missing.', param);
                    paramTypes.push(badType);
                    vars.push({ name: param.name, isParam: true, ty: badType });
                    continue;
                }
                const paramTy = resolveTypeName(a, param.ty);
                paramTypes.push(paramTy);
                vars.push({ name: param.name, isParam: true, ty: paramTy });
            }
            const ty = newFunctionType(paramTypes, returnTy);

            // export specifier
            if (node.exported) {
                a.dispatchWarn('exported function is not supported yet.', node);
            }

            const symbol: FunctionSymbol = {
                kind: 'FnSymbol',
                defined: false,
                params,
                ty,
                vars,
            };
            a.symbolTable.set(node, symbol);
            a.env.set(node.name, symbol);
            break;
        }
        case 'StructDecl': {
            // params
            const fields: { name: string, ty: Type }[] = node.fields.map(x => {
                return {
                    name: x.name,
                    ty: resolveTypeName(a, x.ty),
                };
            });

            // export specifier
            if (node.exported) {
                a.dispatchWarn('`export` keyword is not supported for a struct.', node);
            }

            const symbol = newStructSymbol(fields);
            a.symbolTable.set(node, symbol);
            a.env.set(node.name, symbol);
            break;
        }
    }
}

function validateFunc(a: AnalyzeContext, node: FunctionDecl) {
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
            defined: true,
            ty: symbol.ty.paramTypes[i],
        };
        a.symbolTable.set(node.params[i], paramSymbol);
        a.env.set(node.params[i].name, paramSymbol);
    }
    for (const statement of node.body) {
        validateStatement(a, statement, false, symbol);
    }
    a.env.leave();
    symbol.defined = true;
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
                defined: (node.body != null),
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
            if (node.target.kind != 'Identifier') {
                a.dispatchError('identifier expected.', node.target);
                return;
            }
            const symbol = a.env.get(node.target.name);
            if (symbol == null) {
                a.dispatchError('unknown identifier.', node.target);
                return;
            }
            a.symbolTable.set(node.target, symbol);
            if (symbol.kind != 'VariableSymbol') {
                a.dispatchError('variable expected.', node.target);
                return;
            }
            let bodyTy = inferType(a, node.body, funcSymbol);
            // if the body returns nothing
            if (compareType(bodyTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                bodyTy = badType;
            }
            // if it was the first assignment
            if (symbol.ty.kind == 'PendingType') {
                symbol.ty = bodyTy;
                const target = node.target;
                const variable = funcSymbol.vars.find(x => x.name == target.name);
                if (variable == null) {
                    throw new UguisuError('variable not found');
                }
                variable.ty = bodyTy;
            }

            switch (node.mode) {
                case '=': {
                    if (compareType(bodyTy, symbol.ty) == 'incompatible') {
                        dispatchTypeError(a, bodyTy, symbol.ty, node.body);
                    }
                    break;
                }
                case '+=':
                case '-=':
                case '*=':
                case '/=':
                case '%=': {
                    if (compareType(symbol.ty, numberType) == 'incompatible') {
                        dispatchTypeError(a, symbol.ty, numberType, node.target);
                    }
                    if (compareType(bodyTy, numberType) == 'incompatible') {
                        dispatchTypeError(a, bodyTy, numberType, node.body);
                    }
                    break;
                }
            }

            symbol.defined = true;
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
            const defined: Record<number, boolean> = {};
            for (const field of node.fields) {
                const fieldIndex = symbol.fields.findIndex(x => x.name == field.name);
                if (fieldIndex == -1) {
                    a.dispatchError(`field \`${field.name}\` is unknown.`, field);
                    continue;
                }
                if (defined[fieldIndex]) {
                    a.dispatchError(`field \`${field.name}\` is duplicated.`, field);
                } else {
                    defined[fieldIndex] = true;
                }
                let bodyTy = inferType(a, field.body, funcSymbol);
                // if the expr returns nothing
                if (compareType(bodyTy, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, field.body);
                    bodyTy = badType;
                }
                if (isValidType(bodyTy)) {
                    if (compareType(bodyTy, symbol.fields[fieldIndex].ty) == 'incompatible') {
                        dispatchTypeError(a, bodyTy, symbol.fields[fieldIndex].ty, field.body);
                    }
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
                    const symbol = a.env.get(targetTy.name);
                    if (symbol == null) {
                        a.dispatchError('unknown type name.', node.target);
                        return badType;
                    }
                    if (symbol.kind != 'StructSymbol') {
                        a.dispatchError('struct expected.', node);
                        return badType;
                    }
                    const field = symbol.fields.find(x => x.name == node.name);
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
