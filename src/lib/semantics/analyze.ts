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
    AnalysisContext,
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
    const ctx = new AnalysisContext(env, symbolTable, projectInfo);
    builtins.setDeclarations(ctx.env);
    for (const n of source.funcs) {
        setDeclaration(ctx, n);
    }
    for (const n of source.funcs) {
        validateFunc(ctx, n);
    }
    // console.log(ctx.symbolTable);

    // print errors
    for (const message of ctx.error) {
        console.log(`Syntax Error: ${message}`);
    }
    for (const warn of ctx.warn) {
        console.log(`Warning: ${warn}`);
    }

    return (ctx.error.length == 0);
}

function setDeclaration(ctx: AnalysisContext, node: AstNode) {
    switch (node.kind) {
        case 'FunctionDecl': { // declare function
            const vars: FnVar[] = [];

            // return type
            let returnTy: MaybeValidType;
            if (node.returnTy != null) {
                returnTy = resolveTypeName(ctx, node.returnTy);
            } else {
                returnTy = 'void';
            }

            // params
            const params: { name: string, ty: MaybeValidType }[] = [];
            for (const param of node.params) {
                // invalid parameter
                if (param.ty == null) {
                    ctx.dispatchError('parameter type missing.', param);
                    params.push({ name: param.name, ty: '(invalid)' });
                    vars.push({ name: param.name, isParam: true, ty: '(invalid)' });
                    continue;
                }
                const paramTy = resolveTypeName(ctx, param.ty);
                params.push({ name: param.name, ty: paramTy });
                vars.push({ name: param.name, isParam: true, ty: paramTy });
            }

            // export specifier
            if (node.exported) {
                ctx.dispatchWarn('exported function is not supported yet.', node);
            }

            const symbol: FunctionSymbol = {
                kind: 'FnSymbol',
                defined: false,
                params,
                returnTy,
                vars,
            };
            ctx.symbolTable.set(node, symbol);
            ctx.env.set(node.name, symbol);
            break;
        }
    }
}

function validateFunc(ctx: AnalysisContext, node: FunctionDecl) {
    // define function
    const symbol = ctx.env.get(node.name);
    if (symbol == null) {
        ctx.dispatchError('undefined symbol.', node);
        return;
    }
    if (symbol.kind != 'FnSymbol') {
        ctx.dispatchError('function expected.', node);
        return;
    }
    ctx.env.enter();
    for (let i = 0; i < node.params.length; i++) {
        const paramSymbol: VariableSymbol = {
            kind: 'VariableSymbol',
            defined: true,
            ty: symbol.params[i].ty,
        };
        ctx.symbolTable.set(node.params[i], paramSymbol);
        ctx.env.set(node.params[i].name, paramSymbol);
    }
    for (const statement of node.body) {
        validateStatement(ctx, statement, false, symbol);
    }
    ctx.env.leave();
    symbol.defined = true;
}

function validateStatement(ctx: AnalysisContext, node: AstNode, allowJump: boolean, funcSymbol: FunctionSymbol) {
    switch (node.kind) {
        case 'VariableDecl': {
            // specified type
            let ty: MaybeValidType;
            if (node.ty != null) {
                ty = resolveTypeName(ctx, node.ty);
            } else {
                ty = '(unresolved)';
            }
            // if it has an initial value
            if (node.body != null) {
                let bodyTy = inferType(ctx, node.body, funcSymbol);
                // if the body returns nothing
                if (bodyTy == 'void') {
                    ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                    bodyTy = '(invalid)';
                }
                if (ty == '(unresolved)') {
                    ty = bodyTy;
                } else {
                    if (isValidType(ty) && isValidType(bodyTy)) {
                        assertType(ctx, bodyTy, ty, node.body);
                    }
                }
            }
            const symbol: VariableSymbol = {
                kind: 'VariableSymbol',
                defined: (node.body != null),
                ty,
            };
            ctx.symbolTable.set(node, symbol);
            ctx.env.set(node.name, symbol);

            funcSymbol.vars.push({
                name: node.name,
                isParam: false,
                ty,
            });
            return;
        }
        case 'AssignStatement': {
            if (node.target.kind != 'Identifier') {
                ctx.dispatchError('identifier expected.', node.target);
                return;
            }
            const symbol = ctx.env.get(node.target.name);
            if (symbol == null) {
                ctx.dispatchError('unknown identifier.', node.target);
                return;
            }
            ctx.symbolTable.set(node.target, symbol);
            if (symbol.kind != 'VariableSymbol') {
                ctx.dispatchError('variable expected.', node.target);
                return;
            }
            let bodyTy = inferType(ctx, node.body, funcSymbol);
            // if the body returns nothing
            if (bodyTy == 'void') {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
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
                        assertType(ctx, bodyTy, symbol.ty, node.body);
                        break;
                    }
                    case '+=':
                    case '-=':
                    case '*=':
                    case '/=':
                    case '%=': {
                        assertType(ctx, symbol.ty, 'number', node.target);
                        assertType(ctx, bodyTy, 'number', node.body);
                        break;
                    }
                }
            }
            symbol.defined = true;
            return;
        }
        case 'IfStatement': {
            let condTy = inferType(ctx, node.cond, funcSymbol);
            // if the condition returns nothing
            if (condTy == 'void') {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.cond);
                condTy = '(invalid)';
            }
            if (isValidType(condTy)) {
                assertType(ctx, condTy, 'bool', node.cond);
            }
            validateBlock(ctx, node.thenBlock, allowJump, funcSymbol);
            validateBlock(ctx, node.elseBlock, allowJump, funcSymbol);
            return;
        }
        case 'LoopStatement': {
            validateBlock(ctx, node.block, true, funcSymbol);
            return;
        }
        case 'ReturnStatement': {
            if (node.expr != null) {
                let ty = inferType(ctx, node.expr, funcSymbol);
                // if the expr returns nothing
                if (ty == 'void') {
                    ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                    ty = '(invalid)';
                }
                if (isValidType(ty) && isValidType(funcSymbol.returnTy)) {
                    assertType(ctx, ty, funcSymbol.returnTy, node.expr);
                }
            }
            return;
        }
        case 'BreakStatement': {
            if (!allowJump) {
                ctx.dispatchError('invalid break statement');
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
            inferType(ctx, node, funcSymbol);
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

function validateBlock(ctx: AnalysisContext, block: StatementNode[], allowJump: boolean, funcSymbol: FunctionSymbol) {
    ctx.env.enter();
    for (const statement of block) {
        validateStatement(ctx, statement, allowJump, funcSymbol);
    }
    ctx.env.leave();
}

function inferType(ctx: AnalysisContext, node: AstNode, funcSymbol: FunctionSymbol): MaybeValidType {
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
            let leftTy = inferType(ctx, node.left, funcSymbol);
            let rightTy = inferType(ctx, node.right, funcSymbol);
            // if the left expr returns nothing
            if (leftTy == 'void') {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.left);
                leftTy = '(invalid)';
            }
            // if the right expr returns nothing
            if (rightTy == 'void') {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.right);
                rightTy = '(invalid)';
            }
            if (isLogicalBinaryOperator(node.operator)) {
                // Logical Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    assertType(ctx, leftTy, 'bool', node.left);
                    assertType(ctx, rightTy, 'bool', node.right);
                    ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'bool' });
                    return 'bool';
                } else {
                    ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                    return '(invalid)';
                }
            } else if (isEquivalentOperator(node.operator)) {
                // Equivalent Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    assertType(ctx, rightTy, leftTy, node.right);
                    ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'bool' });
                    return 'bool';
                } else {
                    ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                    return '(invalid)';
                }
            } else if (isOrderingOperator(node.operator)) {
                // Ordering Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    assertType(ctx, leftTy, 'number', node.left);
                    assertType(ctx, rightTy, 'number', node.right);
                    ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'bool' });
                    return 'bool';
                } else {
                    ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                    return '(invalid)';
                }
            } else {
                // Arithmetic Operation
                if (isValidType(leftTy) && isValidType(rightTy)) {
                    assertType(ctx, leftTy, 'number', node.left);
                    assertType(ctx, rightTy, 'number', node.right);
                    ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'number' });
                    return 'number';
                } else {
                    ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                    return '(invalid)';
                }
            }
            break;
        }
        case 'UnaryOp': {
            let ty = inferType(ctx, node.expr, funcSymbol);
            // if the expr returns nothing
            if (ty == 'void') {
                ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                ty = '(invalid)';
            }
            // Logical Operation
            if (isValidType(ty)) {
                assertType(ctx, ty, 'bool', node);
                ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: 'bool' });
                return 'bool';
            } else {
                ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: '(invalid)' });
                return '(invalid)';
            }
            break;
        }
        case 'Identifier': {
            if (node.kind != 'Identifier') {
                ctx.dispatchError('identifier expected.', node);
                return '(invalid)';
            }
            const symbol = ctx.env.get(node.name);
            if (symbol == null) {
                ctx.dispatchError('unknown identifier.', node);
                return '(invalid)';
            }
            ctx.symbolTable.set(node, symbol);
            switch (symbol.kind) {
                case 'FnSymbol':
                case 'NativeFnSymbol': {
                    return 'function';
                }
                case 'VariableSymbol': {
                    // if the variable is not assigned
                    if (symbol.ty == '(unresolved)') {
                        ctx.dispatchError('variable is not assigned yet.', node);
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
                ctx.dispatchError('identifier expected.', node.callee);
                return '(invalid)';
            }
            const calleeSymbol = ctx.env.get(node.callee.name);
            if (calleeSymbol == null) {
                ctx.dispatchError('unknown identifier.', node);
                return '(invalid)';
            }
            ctx.symbolTable.set(node.callee, calleeSymbol);
            switch (calleeSymbol.kind) {
                case 'FnSymbol':
                case 'NativeFnSymbol': {
                    break;
                }
                case 'VariableSymbol': {
                    // if the variable is not assigned
                    if (calleeSymbol.ty == '(unresolved)') {
                        ctx.dispatchError('variable is not assigned yet.', node.callee);
                        return '(invalid)';
                    }
                    if (isValidType(calleeSymbol.ty)) {
                        assertType(ctx, calleeSymbol.ty, 'function', node.callee);
                    }
                    ctx.dispatchError('type check for a function variable is not supported.', node.callee);
                    return '(invalid)';
                }
                case 'ExprSymbol': {
                    throw new UguisuError('unexpected symbol');
                }
            }
            if (node.args.length == calleeSymbol.params.length) {
                for (let i = 0; i < calleeSymbol.params.length; i++) {
                    const param = calleeSymbol.params[i];
                    let argTy = inferType(ctx, node.args[i], funcSymbol);
                    // if the argument returns nothing
                    if (argTy == 'void') {
                        ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.args[i]);
                        argTy = '(invalid)';
                    }
                    if (isValidType(argTy) && isValidType(param.ty)) {
                        assertType(ctx, argTy, param.ty, node.args[i]);
                    }
                }
            } else {
                ctx.dispatchError('argument count incorrect.', node);
            }
            ctx.symbolTable.set(node, { kind: 'ExprSymbol', ty: calleeSymbol.returnTy });
            return calleeSymbol.returnTy;
        }
    }
    throw new UguisuError('unexpected node.');
}

function resolveTypeName(ctx: AnalysisContext, node: TyLabel): MaybeValidType {
    switch (node.name) {
        case 'number':
        case 'bool':
        case 'string': {
            return node.name;
        }
    }
    ctx.dispatchError('unknown type name.', node);
    return '(invalid)';
}
