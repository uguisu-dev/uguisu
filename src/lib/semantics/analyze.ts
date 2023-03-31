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

function lookupSymbol(node: ExprNode, a: AnalyzeContext): Symbol | undefined {
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
            // TODO: get symbol
            // TODO: expect function symbol
            // TODO: resolve type
            break;
        }
        case 'StructDecl': {
            // TODO: get symbol
            // TODO: expect struct symbol
            // TODO: resolve type
            break;
        }
    }
}

function analyzeTopLevel(node: FileNode, a: AnalyzeContext) {
    switch (node.kind) {
        case 'FunctionDecl': {
            // TODO: get function symbol
            // TODO: check the function type is valid
            // TODO: validate function body
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
            // returned value
            if (node.expr != null) {
                let ty = analyzeExpr(node.expr, funcSymbol, a);
                // if the expr returned nothing
                if (compareType(ty, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
                    ty = badType;
                }
                // check expr type
                if (isValidType(funcSymbol.ty)) {
                    if (compareType(ty, funcSymbol.ty.returnType) == 'incompatible') {
                        dispatchTypeError(a, ty, funcSymbol.ty.returnType, node.expr);
                    }
                }
            }
            return;
        }
        case 'BreakStatement': {
            // if there is no associated loop
            if (!allowJump) {
                a.dispatchError('invalid break statement');
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
            // if the expr returned nothing
            if (compareType(condTy, voidType) == 'compatible') {
                a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.cond);
                condTy = badType;
            }
            // check expr type
            if (compareType(condTy, boolType) == 'incompatible') {
                dispatchTypeError(a, condTy, boolType, node.cond);
            }
            analyzeBlock(node.thenBlock, allowJump, funcSymbol, a);
            analyzeBlock(node.elseBlock, allowJump, funcSymbol, a);
            return;
        }
        case 'VariableDecl': {
            // get specified type
            let ty: Type;
            if (node.ty != null) {
                ty = resolveTyLabel(node.ty, a);
            } else {
                ty = pendingType;
            }
            // initial value
            if (node.body != null) {
                let bodyTy = analyzeExpr(node.body, funcSymbol, a);
                // if the expr returned nothing
                if (compareType(bodyTy, voidType) == 'compatible') {
                    a.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
                    bodyTy = badType;
                }
                if (ty.kind == 'PendingType') {
                    // set inferred type
                    ty = bodyTy;
                } else {
                    // check expr type
                    // TODO
                }
            }
            // TODO: set symbol
            return;
        }
        case 'AssignStatement': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
    }
    throw new UguisuError('unexpected node');
}

function analyzeExpr(node: ExprNode, funcSymbol: FunctionSymbol, a: AnalyzeContext): Type {
    // validate expression
    switch (node.kind) {
        case 'Identifier': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'FieldAccess': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'IndexAccess': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'NumberLiteral': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'BoolLiteral': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'StringLiteral': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
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
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'ArrayNode': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
    }
    throw new UguisuError('unexpected node');
}
