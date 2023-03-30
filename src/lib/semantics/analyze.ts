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

    // 1st phase: collect
    for (const node of source.decls) {
        collectTopLevel(node, a);
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

function collectTopLevel(node: FileNode, a: AnalyzeContext) {
    switch (node.kind) {
        case 'FunctionDecl': {
            break;
        }
        case 'StructDecl': {
            break;
        }
    }
}

function resolveTopLevel(node: FileNode, a: AnalyzeContext) {
    switch (node.kind) {
        case 'FunctionDecl': {
            break;
        }
        case 'StructDecl': {
            break;
        }
    }
}

function validateTopLevel(node: FileNode, a: AnalyzeContext) {
    switch (node.kind) {
        case 'FunctionDecl': {
            break;
        }
        case 'StructDecl': {
            break;
        }
    }
}
