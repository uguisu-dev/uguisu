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
    StatementCoreNode,
    StatementNode,
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
    compareType,
    createFunctionSymbol,
    createFunctionType,
    createNamedType,
    createStructSymbol,
    dispatchTypeError,
    FunctionSymbol,
    getTypeString,
    isValidType,
    numberType,
    pendingType,
    stringType,
    Symbol,
    Type,
    VariableSymbol,
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

function analyzeLookupExpr(node: ReferenceExpr, funcSymbol: FunctionSymbol, a: AnalyzeContext): Symbol | undefined {
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
            const targetTy = analyzeExpr(node.target, funcSymbol, a);

            if (!isValidType(targetTy)) {
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
            // analyze target
            const targetTy = analyzeExpr(node.target, funcSymbol, a);

            if (!isValidType(targetTy)) {
                return undefined;
            }

            // check target type
            if (compareType(targetTy, arrayType) == 'incompatible') {
                dispatchTypeError(targetTy, arrayType, node.index, a);
                return undefined;
            }

            // create index symbol
            const symbol: VariableSymbol = {
                kind: 'VariableSymbol',
                ty: anyType,
            };
            return symbol;
        }
    }
    throw new UguisuError('unexpected node');
}

function getTypeFromSymbol(symbol: Symbol): Type {
    // TODO
    throw new UguisuError('not implemented yet');
}

function resolveTyLabel(node: TyLabel, a: AnalyzeContext): Type {
    // TODO
    throw new UguisuError('not implemented yet');
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

            // TODO: declare

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

            // TODO: declare

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
                return;
            }

            a.env.enter();

            // set function params to the env
            for (let i = 0; i < node.params.length; i++) {
                const paramSymbol: VariableSymbol = {
                    kind: 'VariableSymbol',
                    ty: symbol.ty.paramTypes[i],
                };
                a.symbolTable.set(node.params[i], paramSymbol);
                a.env.set(node.params[i].name, paramSymbol);
            }

            // analyze function body
            for (const statement of node.body) {
                analyzeNode(statement, false, symbol, a);
            }

            a.env.leave();
            break;
        }
        case 'StructDecl': {
            // nop
            break;
        }
    }
}

function analyzeBlock(nodes: StatementNode[], allowJump: boolean, funcSymbol: FunctionSymbol, a: AnalyzeContext) {
    a.env.enter();
    // analyze inner
    for (const node of nodes) {
        analyzeNode(node, allowJump, funcSymbol, a);
    }
    a.env.leave();
}

function analyzeNode(node: StatementNode, allowJump: boolean, funcSymbol: FunctionSymbol, a: AnalyzeContext) {
    if (isExprNode(node)) {
        analyzeExpr(node, funcSymbol, a);
    } else {
        analyzeStatement(node, allowJump, funcSymbol, a);
    }
}

function analyzeStatement(node: StatementCoreNode, allowJump: boolean, funcSymbol: FunctionSymbol, a: AnalyzeContext) {
    switch (node.kind) {
        case 'ReturnStatement': {
            // if there is a return value
            if (node.expr != null) {
                let ty = analyzeExpr(node.expr, funcSymbol, a);

                // if the expr returned nothing
                if (compareType(ty, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                    ty = badType;
                }

                // check type
                if (isValidType(funcSymbol.ty)) {
                    if (compareType(ty, funcSymbol.ty.returnType) == 'incompatible') {
                        dispatchTypeError(ty, funcSymbol.ty.returnType, node.expr, a);
                    }
                }
            }
            return;
        }
        case 'BreakStatement': {
            // if there is no associated loop
            if (!allowJump) {
                a.dispatchError('invalid break statement.');
            }
            return;
        }
        case 'LoopStatement': {
            // allow break
            allowJump = true;
            analyzeBlock(node.block, allowJump, funcSymbol, a);
            return;
        }
        case 'IfStatement': {
            let condTy = analyzeExpr(node.cond, funcSymbol, a);
            analyzeBlock(node.thenBlock, allowJump, funcSymbol, a);
            analyzeBlock(node.elseBlock, allowJump, funcSymbol, a);

            // if the condition expr returned nothing
            if (compareType(condTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.cond);
                condTy = badType;
            }

            // check type
            if (compareType(condTy, boolType) == 'incompatible') {
                dispatchTypeError(condTy, boolType, node.cond, a);
            }
            return;
        }
        case 'VariableDecl': {
            let ty: Type = pendingType;

            // if an explicit type is specified
            if (node.ty != null) {
                ty = resolveTyLabel(node.ty, a);
            }

            // initializer
            if (node.body != null) {
                let bodyTy = analyzeExpr(node.body, funcSymbol, a);

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
            }

            // set symbol
            const symbol: VariableSymbol = {
                kind: 'VariableSymbol',
                ty,
            };
            a.symbolTable.set(node, symbol);
            a.env.set(node.name, symbol);

            return;
        }
        case 'AssignStatement': {
            let bodyTy = analyzeExpr(node.body, funcSymbol, a);

            // if the body returns nothing
            if (compareType(bodyTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                bodyTy = badType;
            }

            // analyze target
            let symbol;
            if (node.target.kind == 'Identifier' || node.target.kind == 'FieldAccess' || node.target.kind == 'IndexAccess') {
                symbol = analyzeLookupExpr(node.target, funcSymbol, a);
            } else {
                a.dispatchError('invalid assign target.');
            }

            // skip if target symbol is invalid
            if (symbol == null) {
                return;
            }

            let targetTy = getTypeFromSymbol(symbol);

            // if it was the first assignment
            if (targetTy.kind == 'PendingType') {
                targetTy = bodyTy;
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
            return;
        }
    }
    throw new UguisuError('unexpected node');
}

function analyzeExpr(node: ExprNode, funcSymbol: FunctionSymbol, a: AnalyzeContext): Type {
    // validate expression
    switch (node.kind) {
        case 'Identifier':
        case 'FieldAccess':
        case 'IndexAccess': {
            const symbol = analyzeLookupExpr(node, funcSymbol, a);
            if (symbol == null) {
                return badType;
            }

            // return expr type from the symbol
            return getTypeFromSymbol(symbol);
        }
        case 'NumberLiteral': {
            // return expr type
            return numberType;
        }
        case 'BoolLiteral': {
            // return expr type
            return boolType;
        }
        case 'StringLiteral': {
            // return expr type
            return stringType;
        }
        case 'Call': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'BinaryOp': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'UnaryOp': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
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
                let bodyTy = analyzeExpr(fieldNode.body, funcSymbol, a);

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

            return createNamedType(node.name);
        }
        case 'ArrayNode': {
            // analyze elements
            for (const item of node.items) {
                analyzeExpr(item, funcSymbol, a);
            }

            // return expr type
            return arrayType;
        }
    }
    throw new UguisuError('unexpected node');
}
