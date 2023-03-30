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
    createSimpleType,
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
    // 3rd phase: validate
    for (const node of source.decls) {
        validateTopLevel(node, a);
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

function validateTopLevel(node: FileNode, a: AnalyzeContext) {
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

function lookupSymbol(node: ExprNode, a: AnalyzeContext): Symbol | undefined {
    // TODO
    throw new UguisuError('not implemented yet');
}

function validateNode(node: StatementNode, funcSymbol: FunctionSymbol, a: AnalyzeContext) {
    if (isExprNode(node)) {
        validateExpr(node, funcSymbol, a);
    } else {
        validateStatement(node, false, funcSymbol, a);
    }
}

function validateStatement(node: StatementCoreNode, allowJump: boolean, funcSymbol: FunctionSymbol, a: AnalyzeContext) {
    switch (node.kind) {
        case 'ReturnStatement': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'BreakStatement': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'LoopStatement': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'IfStatement': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'VariableDecl': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
        case 'AssignStatement': {
            // TODO
            throw new UguisuError('not implemented yet');
            break;
        }
    }
    throw new UguisuError('unexpected node');
}

function validateExpr(node: ExprNode, funcSymbol: FunctionSymbol, a: AnalyzeContext): Type {
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
