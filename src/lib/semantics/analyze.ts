import { UguisuError } from '../misc/errors.js';
import { ProjectInfo } from '../project-file.js';
import {
    AstNode,
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
    MaybeValidType,
    VariableSymbol,
    isValidType,
    assertType
} from './tools.js';

export function analyze(source: SourceFile, env: AnalysisEnv, symbolTable: Map<AstNode, Symbol>, projectInfo: ProjectInfo): boolean {
    const a = new AnalyzeContext(env, symbolTable, projectInfo);
    builtins.setDeclarations(a.env);
    for (const n of source.funcs) {
        setDeclaration(a, n);
    }
    for (const n of source.funcs) {
        validateFunc(a, n);
    }
    // console.log(ctx.symbolTable);

    // print errors
    for (const message of a.error) {
        console.log(`Syntax Error: ${message}`);
    }
    for (const warn of a.warn) {
        console.log(`Warning: ${warn}`);
    }

    return (a.error.length == 0);
}

function setDeclaration(a: AnalyzeContext, node: AstNode) {
    switch (node.kind) {
        case 'FunctionDecl': { // declare function
            const vars: FnVar[] = [];

            // return type
            let returnTy: MaybeValidType;
            if (node.returnTy != null) {
                returnTy = resolveTypeName(a, node.returnTy);
            } else {
                returnTy = 'void';
            }

            // params
            const params: { name: string, ty: MaybeValidType }[] = [];
            for (const param of node.params) {
                // invalid parameter
                if (param.ty == null) {
                    a.dispatchError('parameter type missing.', param);
                    params.push({ name: param.name, ty: '(invalid)' });
                    vars.push({ name: param.name, isParam: true, ty: '(invalid)' });
                    continue;
                }
                const paramTy = resolveTypeName(a, param.ty);
                params.push({ name: param.name, ty: paramTy });
                vars.push({ name: param.name, isParam: true, ty: paramTy });
            }

            // export specifier
            if (node.exported) {
                a.dispatchWarn('exported function is not supported yet.', node);
            }

            const symbol: FunctionSymbol = {
                kind: 'FnSymbol',
                defined: false,
                params,
                returnTy,
                vars,
            };
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
    a.env.enter();
    for (let i = 0; i < node.params.length; i++) {
        const paramSymbol: VariableSymbol = {
            kind: 'VariableSymbol',
            defined: true,
            ty: symbol.params[i].ty,
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

function validateStatement(a: AnalyzeContext, node: AstNode, allowJump: boolean, funcSymbol: FunctionSymbol) {
    switch (node.kind) {
        case 'VariableDecl': {
            // specified type
            let ty: MaybeValidType;
            if (node.ty != null) {
                ty = resolveTypeName(a, node.ty);
            } else {
                ty = '(unresolved)';
            }
            // if it has an initial value
            if (node.body != null) {
                let bodyTy = inferType(a, node.body, funcSymbol);
                // if the body returns nothing
                if (bodyTy == 'void') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                    bodyTy = '(invalid)';
                }
                if (ty == '(unresolved)') {
                    ty = bodyTy;
                } else {
                    if (isValidType(ty) && isValidType(bodyTy)) {
                        assertType(a, bodyTy, ty, node.body);
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
            if (bodyTy == 'void') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                bodyTy = '(invalid)';
            }
            // if it was the first assignment
            if (symbol.ty == '(unresolved)') {
                symbol.ty = bodyTy;
                const target = node.target;
                const variable = funcSymbol.vars.find(x => x.name == target.name);
                if (variable == null) {
                    throw new UguisuError('variable not found');
                }
                variable.ty = bodyTy;
            }
            if (isValidType(bodyTy) && isValidType(symbol.ty)) {
                switch (node.mode) {
                    case '=': {
                        assertType(a, bodyTy, symbol.ty, node.body);
                        break;
                    }
                    case '+=':
                    case '-=':
                    case '*=':
                    case '/=':
                    case '%=': {
                        assertType(a, symbol.ty, 'number', node.target);
                        assertType(a, bodyTy, 'number', node.body);
                        break;
                    }
                }
            }
            symbol.defined = true;
            return;
        }
        case 'IfStatement': {
            let condTy = inferType(a, node.cond, funcSymbol);
            // if the condition returns nothing
            if (condTy == 'void') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.cond);
                condTy = '(invalid)';
            }
            if (isValidType(condTy)) {
                assertType(a, condTy, 'bool', node.cond);
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
                if (ty == 'void') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                    ty = '(invalid)';
                }
                if (isValidType(ty) && isValidType(funcSymbol.returnTy)) {
                    assertType(a, ty, funcSymbol.returnTy, node.expr);
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
        case 'Call': {
            inferType(a, node, funcSymbol);
            return;
        }
        case 'SourceFile':
        case 'FunctionDecl':
        case 'FnDeclParam':
        case 'TyLabel': {
            throw new UguisuError('unexpected node.');
        }
    }
    throw new UguisuError('unexpected node.');
}

function validateBlock(a: AnalyzeContext, block: StatementNode[], allowJump: boolean, funcSymbol: FunctionSymbol) {
    a.env.enter();
    for (const statement of block) {
        validateStatement(a, statement, allowJump, funcSymbol);
    }
    a.env.leave();
}

function inferType(a: AnalyzeContext, node: AstNode, funcSymbol: FunctionSymbol): MaybeValidType {
    switch (node.kind) {
        case 'NumberLiteral': {
            return 'number';
        }
        case 'BoolLiteral': {
            return 'bool';
        }
        case 'StringLiteral': {
            return 'string';
        }
        case 'BinaryOp': {
            let leftTy = inferType(a, node.left, funcSymbol);
            let rightTy = inferType(a, node.right, funcSymbol);
            // if the left expr returns nothing
            if (leftTy == 'void') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.left);
                leftTy = '(invalid)';
            }
            // if the right expr returns nothing
            if (rightTy == 'void') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.right);
                rightTy = '(invalid)';
            }
            if (isLogicalBinaryOperator(node.operator)) {
                // Logical Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    assertType(a, leftTy, 'bool', node.left);
                    assertType(a, rightTy, 'bool', node.right);
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'bool' });
                    return 'bool';
                } else {
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                    return '(invalid)';
                }
            } else if (isEquivalentOperator(node.operator)) {
                // Equivalent Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    assertType(a, rightTy, leftTy, node.right);
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'bool' });
                    return 'bool';
                } else {
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                    return '(invalid)';
                }
            } else if (isOrderingOperator(node.operator)) {
                // Ordering Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    assertType(a, leftTy, 'number', node.left);
                    assertType(a, rightTy, 'number', node.right);
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'bool' });
                    return 'bool';
                } else {
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                    return '(invalid)';
                }
            } else {
                // Arithmetic Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    assertType(a, leftTy, 'number', node.left);
                    assertType(a, rightTy, 'number', node.right);
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'number' });
                    return 'number';
                } else {
                    a.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                    return '(invalid)';
                }
            }
            break;
        }
        case 'UnaryOp': {
            let ty = inferType(a, node.expr, funcSymbol);
            // if the expr returns nothing
            if (ty == 'void') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                ty = '(invalid)';
            }
            // Logical Operation
            if (isValidType(ty)) {
                assertType(a, ty, 'bool', node);
                a.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'bool' });
                return 'bool';
            } else {
                a.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                return '(invalid)';
            }
            break;
        }
        case 'Identifier': {
            if (node.kind != 'Identifier') {
                a.dispatchError('identifier expected.', node);
                return '(invalid)';
            }
            const symbol = a.env.get(node.name);
            if (symbol == null) {
                a.dispatchError('unknown identifier.', node);
                return '(invalid)';
            }
            a.symbolTable.set(node, symbol);
            switch (symbol.kind) {
                case 'FnSymbol':
                case 'NativeFnSymbol': {
                    return 'function';
                }
                case 'VariableSymbol': {
                    // if the variable is not assigned
                    if (symbol.ty == '(unresolved)') {
                        a.dispatchError('variable is not assigned yet.', node);
                        return '(invalid)';
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
                return '(invalid)';
            }
            const calleeSymbol = a.env.get(node.callee.name);
            if (calleeSymbol == null) {
                a.dispatchError('unknown identifier.', node);
                return '(invalid)';
            }
            a.symbolTable.set(node.callee, calleeSymbol);
            switch (calleeSymbol.kind) {
                case 'FnSymbol':
                case 'NativeFnSymbol': {
                    break;
                }
                case 'VariableSymbol': {
                    // if the variable is not assigned
                    if (calleeSymbol.ty == '(unresolved)') {
                        a.dispatchError('variable is not assigned yet.', node.callee);
                        return '(invalid)';
                    }
                    if (isValidType(calleeSymbol.ty)) {
                        assertType(a, calleeSymbol.ty, 'function', node.callee);
                    }
                    a.dispatchError('type check for a function variable is not supported.', node.callee);
                    return '(invalid)';
                }
                case 'ExprSymbol': {
                    throw new UguisuError('unexpected symbol');
                }
            }
            if (node.args.length == calleeSymbol.params.length) {
                for (let i = 0; i < calleeSymbol.params.length; i++) {
                    const param = calleeSymbol.params[i];
                    let argTy = inferType(a, node.args[i], funcSymbol);
                    // if the argument returns nothing
                    if (argTy == 'void') {
                        a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.args[i]);
                        argTy = '(invalid)';
                    }
                    if (isValidType(argTy) && isValidType(param.ty)) {
                        assertType(a, argTy, param.ty, node.args[i]);
                    }
                }
            } else {
                a.dispatchError('argument count incorrect.', node);
            }
            a.symbolTable.set(node, { kind: 'ExprSymbol', ty: calleeSymbol.returnTy });
            return calleeSymbol.returnTy;
        }
    }
    throw new UguisuError('unexpected node.');
}

function resolveTypeName(a: AnalyzeContext, node: TyLabel): MaybeValidType {
    switch (node.name) {
        case 'number':
        case 'bool':
        case 'string': {
            return node.name;
        }
    }
    a.dispatchError('unknown type name.', node);
    return '(invalid)';
}
