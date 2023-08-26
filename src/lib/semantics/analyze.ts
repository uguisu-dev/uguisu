import charRegex from 'char-regex';
import { UguisuError } from '../misc/errors.js';
import { ProjectInfo } from '../project-file.js';
import {
  SyntaxNode,
  ExprNode,
  FileNode,
  isEquivalentOperator,
  isExprNode,
  isLogicalBinaryOperator,
  isOrderingOperator,
  SourceFile,
  StatementNode,
  StepNode,
  TyLabel
} from '../syntax/node.js';
import * as builtins from './builtins.js';
import {
  ExprSymbol,
  FuncSymbol,
  StructFieldSymbol,
  StructSymbol,
  Symbol,
  VariableSymbol
} from './symbol.js';
import { AnalysisEnv, AnalyzeContext } from './common.js';
import {
  anyType,
  arrayType,
  badType,
  boolType,
  charType,
  compareType,
  dispatchTypeError,
  FunctionType,
  getTypeString,
  isNeverType,
  isPendingType,
  isValidType,
  NamedType,
  neverType,
  numberType,
  pendingType,
  stringType,
  Type,
  voidType
} from './type.js';
import { Token } from '../syntax/token.js';

type StatementResult =
  | 'invalid'
  | 'ok'
  | 'return'
  | 'break';

export class AnalyzeResult {
  constructor(
    public success: boolean,
    public errors: string[],
    public warnings: string[],
  ) { }
}

export function analyze(
  source: SourceFile,
  env: AnalysisEnv,
  symbolTable: Map<SyntaxNode, Symbol>,
  projectInfo: ProjectInfo
): AnalyzeResult {
  const ctx = new AnalyzeContext(env, symbolTable, projectInfo);
  builtins.setDeclarations(ctx);

  // 1st phase: declare
  for (const node of source.decls) {
    declareTopLevel(node, ctx);
  }
  // 2nd phase: resolve
  for (const node of source.decls) {
    resolveTopLevel(node, ctx);
  }
  // 3rd phase: analyze
  for (const node of source.decls) {
    analyzeTopLevel(node, ctx);
  }

  if (ctx.isUsedAnyType) {
    ctx.dispatchWarn('type checking of array elements is not supported yet.');
  }

  return new AnalyzeResult((ctx.error.length == 0), ctx.error, ctx.warn);
}

function declareTopLevel(node: FileNode, ctx: AnalyzeContext) {
  switch (node.kind) {
    case 'FunctionDecl': {
      // check for duplicate
      if (ctx.env.get(node.name) != null) {
        ctx.dispatchError(`\`${node.name}\` is already declared.`);
        return;
      }

      // export specifier
      if (node.exported) {
        ctx.dispatchWarn('exported function is not supported yet.', node);
      }

      // make param list
      const params = node.params.map(x => ({ name: x.name, ty: pendingType }));

      // declare function
      const symbol = new FuncSymbol(false, params, pendingType, []);
      ctx.symbolTable.set(node, symbol);
      ctx.env.set(node.name, symbol);
      break;
    }
    case 'StructDecl': {
      // check for duplicate
      if (ctx.env.get(node.name) != null) {
        ctx.dispatchError(`\`${node.name}\` is already declared.`);
        return;
      }

      // export specifier
      if (node.exported) {
        ctx.dispatchWarn('exported function is not supported yet.', node);
      }

      // make fields
      const fields = new Map<string, StructFieldSymbol>();
      for (const field of node.fields) {
        const fieldSymbol = new StructFieldSymbol(node.name, pendingType);
        fields.set(field.name, fieldSymbol);
      }

      // declare struct
      const symbol: Symbol = new StructSymbol(node.name, fields);
      ctx.symbolTable.set(node, symbol);
      ctx.env.set(node.name, symbol);
      break;
    }
  }
}

function resolveTopLevel(node: FileNode, ctx: AnalyzeContext) {
  switch (node.kind) {
    case 'FunctionDecl': {
      // get symbol
      const symbol = ctx.env.get(node.name);
      if (symbol == null) {
        throw new UguisuError('symbol not found.');
      }

      // expect function symbol
      if (symbol.kind != 'FuncSymbol') {
        ctx.dispatchError('function expected.', node);
        return;
      }

      // make return type
      let retTy: Type;
      if (node.returnTy != null) {
        retTy = resolveTyLabel(node.returnTy, ctx);
      } else {
        retTy = voidType;
      }

      // make params type
      let funcParams: FuncSymbol['params'][number][] = [];
      for (let i = 0; i < symbol.params.length; i++) {
        const paramNode = node.params[i];

        // if param type is not specified
        if (paramNode.ty == null) {
          ctx.dispatchError('parameter type missing.', paramNode);
          funcParams.push({ name: node.params[i].name, ty: badType });
          continue;
        }

        // get param type
        const paramTy = resolveTyLabel(paramNode.ty, ctx);
        funcParams.push({ name: node.params[i].name, ty: paramTy });
      }

      // replace function type
      symbol.isDefined = true;
      symbol.params = funcParams;
      symbol.retTy = retTy;
      break;
    }
    case 'StructDecl': {
      // get symbol
      const structSymbol = ctx.env.get(node.name);
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

        // replace field type
        fieldSymbol.ty = resolveTyLabel(field.ty, ctx);
      }
      break;
    }
  }
}

function analyzeTopLevel(node: FileNode, ctx: AnalyzeContext) {
  switch (node.kind) {
    case 'FunctionDecl': {
      // get function symbol
      const symbol = ctx.env.get(node.name);
      if (symbol == null) {
        throw new UguisuError('symbol not found.');
      }

      // expect defined function symbol
      if (symbol.kind != 'FuncSymbol') {
        ctx.dispatchError('function expected.', node);
        return;
      }
      if (!symbol.isDefined) {
        ctx.dispatchError('function is not defined yet.', node);
        return;
      }

      // check the function type is valid
      if (symbol.params.some(x => !isValidType(x.ty))) {
        return;
      }

      const beforeAnalyzeBlock = () => {
        // set function params to the env
        for (let i = 0; i < node.params.length; i++) {
          const paramSymbol = new VariableSymbol(true, symbol.params[i].ty);
          ctx.symbolTable.set(node.params[i], paramSymbol);
          ctx.env.set(node.params[i].name, paramSymbol);
        }
      }

      // analyze function body
      const retTy = analyzeBlock(node.body, false, symbol, ctx, beforeAnalyzeBlock);

      // check return type
      if (!isNeverType(retTy)) {
        if (compareType(retTy, symbol.retTy) == 'incompatible') {
          dispatchTypeError(retTy, symbol.retTy, node, ctx);
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
function analyzeBlock(nodes: StepNode[], allowJump: boolean, funcSymbol: FuncSymbol, ctx: AnalyzeContext, before?: () => void): Type {
  if (funcSymbol.params.some(x => !isValidType(x.ty))) {
    throw new UguisuError('unexpected type');
  }
  if (!isValidType(funcSymbol.retTy)) {
    throw new UguisuError('unexpected type');
  }

  ctx.env.enter();

  if (before != null) {
    before();
  }

  let blockTy: Type = voidType;

  // analyze inner
  for (let i = 0; i < nodes.length; i++) {
    const step = nodes[i];

    let ty;
    if (isExprNode(step)) {
      ty = analyzeExpr(step, allowJump, funcSymbol, ctx);
    } else {
      const result = analyzeStatement(step, allowJump, funcSymbol, ctx);
      switch (result) {
        case 'ok': {
          ty = voidType;
          break;
        }
        case 'invalid': {
          ty = badType;
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

  ctx.env.leave();

  return blockTy;
}

function analyzeStatement(node: StatementNode, allowJump: boolean, funcSymbol: FuncSymbol, ctx: AnalyzeContext): StatementResult {
  switch (node.kind) {
    case 'ExprStatement': {
      analyzeExpr(node.expr, allowJump, funcSymbol, ctx);
      return 'ok';
    }
    case 'ReturnStatement': {
      // if there is a return value
      if (node.expr != null) {
        let ty = analyzeExpr(node.expr, allowJump, funcSymbol, ctx);

        // if the expr returned nothing
        if (compareType(ty, voidType) == 'compatible') {
          ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
          ty = badType;
        }

        // check type
        if (compareType(ty, funcSymbol.retTy) == 'incompatible') {
          dispatchTypeError(ty, funcSymbol.retTy, node.expr, ctx);
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

      const ty = analyzeBlock(node.block, allowJump, funcSymbol, ctx);

      // check block
      if (compareType(ty, voidType) == 'incompatible') {
        dispatchTypeError(ty, voidType, node, ctx);
      }
      return 'ok';
    }
    case 'VariableDecl': {
      let isDefined = false;
      let ty: Type = pendingType;

      // if an explicit type is specified
      if (node.ty != null) {
        ty = resolveTyLabel(node.ty, ctx);
      }

      // initializer
      if (node.body != null) {
        let bodyTy = analyzeExpr(node.body, allowJump, funcSymbol, ctx);

        // if the initializer returns nothing
        if (compareType(bodyTy, voidType) == 'compatible') {
          ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
          bodyTy = badType;
        }

        // if the variable type is not decided
        if (isPendingType(ty)) {
          ty = bodyTy;
        }

        // check type
        if (compareType(bodyTy, ty) == 'incompatible') {
          dispatchTypeError(bodyTy, ty, node.body, ctx);
        }

        isDefined = true;
      }

      // set symbol
      const symbol = new VariableSymbol(isDefined, ty);
      ctx.symbolTable.set(node, symbol);
      ctx.env.set(node.name, symbol);

      return 'ok';
    }
    case 'AssignStatement': {
      let bodyTy = analyzeExpr(node.body, allowJump, funcSymbol, ctx);

      // if the body returns nothing
      if (compareType(bodyTy, voidType) == 'compatible') {
        ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
        bodyTy = badType;
      }

      // analyze target
      let targetTy = analyzeExpr(node.target, allowJump, funcSymbol, ctx);
      let symbol = ctx.symbolTable.get(node.target);

      // variable symbol?
      if (symbol == null || symbol.kind != 'VariableSymbol') {
        ctx.dispatchError('invalid assign target.', node.target);
        return 'invalid';
      }

      // if it was the first assignment
      if (!symbol.isDefined) {
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
            dispatchTypeError(bodyTy, targetTy, node.body, ctx);
          }
          break;
        }
        case '+=':
        case '-=':
        case '*=':
        case '/=':
        case '%=': {
          if (compareType(targetTy, numberType) == 'incompatible') {
            dispatchTypeError(targetTy, numberType, node.target, ctx);
          }
          if (compareType(bodyTy, numberType) == 'incompatible') {
            dispatchTypeError(bodyTy, numberType, node.body, ctx);
          }
          break;
        }
      }
      return 'ok';
    }
  }
  throw new UguisuError('unexpected node');
}

function analyzeExpr(node: ExprNode, allowJump: boolean, funcSymbol: FuncSymbol, ctx: AnalyzeContext): Type {
  // validate expression
  switch (node.kind) {
    case 'Identifier': {
      const symbol = ctx.env.get(node.name);
      if (symbol == null) {
        ctx.dispatchError('unknown identifier.', node);
        return badType;
      }
      ctx.symbolTable.set(node, symbol);

      // if the variable is not assigned
      if (symbol.kind == 'VariableSymbol' && !symbol.isDefined) {
        ctx.dispatchError('variable is not assigned yet.', node);
        return badType;
      }

      switch (symbol.kind) {
        case 'VariableSymbol':
        case 'StructFieldSymbol': {
          return symbol.ty;
        }
        case 'FuncSymbol':
        case 'NativeFuncSymbol': {
          return new FunctionType(symbol.params.map(x => x.ty), symbol.retTy);
        }
        case 'StructSymbol':
        case 'ExprSymbol': {
          ctx.dispatchError('invalid identifier.', node);
          return badType;
        }
      }
      break;
    }
    case 'FieldAccess': {
      // analyze target
      const targetTy = analyzeExpr(node.target, allowJump, funcSymbol, ctx);

      if (!isValidType(targetTy)) {
        return badType;
      }

      const symbol = ctx.symbolTable.get(node.target);

      console.log(symbol);

      if (symbol == null || symbol.kind != 'StructSymbol') {
        ctx.dispatchError('invalid field access.', node);
        return badType;
      }

      // get field symbol
      const field = symbol.fields.get(node.name);

      // if specified field name is invalid
      if (field == null) {
        ctx.dispatchError('unknown field name.', node);
        return badType;
      }

      ctx.symbolTable.set(node, field);

      // if the variable is not assigned
      if (!isValidType(field.ty)) {
        ctx.dispatchError('invalid field type.', node);
        return badType;
      }

      return field.ty;
    }
    case 'IndexAccess': {
      const targetTy = analyzeExpr(node.target, allowJump, funcSymbol, ctx);
      const indexTy = analyzeExpr(node.index, allowJump, funcSymbol, ctx);

      // check target type
      if (compareType(targetTy, arrayType) == 'incompatible') {
        dispatchTypeError(targetTy, arrayType, node.target, ctx);
        return badType;
      }

      // check index type
      if (compareType(indexTy, numberType) == 'incompatible') {
        dispatchTypeError(indexTy, numberType, node.index, ctx);
        return badType;
      }

      if (!isValidType(targetTy)) {
        if (isPendingType(targetTy)) {
          ctx.dispatchError('variable is not assigned yet.', node.target);
        }
        return badType;
      }

      if (!isValidType(indexTy)) {
        if (isPendingType(indexTy)) {
          ctx.dispatchError('variable is not assigned yet.', node.index);
        }
        return badType;
      }

      // create index symbol
      const symbol = new VariableSymbol(true, anyType);

      ctx.symbolTable.set(node, symbol);

      return symbol.ty;
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
      // analyze callee
      const calleeTy = analyzeExpr(node.callee, allowJump, funcSymbol, ctx);
      let calleeSymbol = ctx.symbolTable.get(node.callee);

      const callables: Symbol['kind'][] = [
        'FuncSymbol',
        'NativeFuncSymbol',
        'VariableSymbol',
      ];
      if (calleeSymbol == null || !callables.includes(calleeSymbol.kind)) {
        ctx.dispatchError('invalid callee.');
        return badType;
      }

      if (calleeSymbol.kind == 'VariableSymbol') {
          // if the variable is not assigned
          if (isPendingType(calleeSymbol.ty)) {
            ctx.dispatchError('variable is not assigned yet.', node.callee);
            return badType;
          }

          if (!isValidType(calleeSymbol.ty)) {
            return badType;
          }

          // expect function
          if (calleeSymbol.ty.kind != 'FunctionType') {
            ctx.dispatchError(`type mismatched. expected function, found \`${getTypeString(calleeSymbol.ty)}\``, node.callee);
            return badType;
          }
      }

      if (calleeTy.kind != 'FunctionType') {
        if (isPendingType(calleeTy)) {
          ctx.dispatchError('callee is not assigned yet.', node.callee);
        }
        return badType;
      }

      let isCorrectArgCount = true;
      if (node.args.length != calleeTy.paramTypes.length) {
        ctx.dispatchError('argument count incorrect.', node);
        isCorrectArgCount = false;
      }

      if (isCorrectArgCount) {
        for (let i = 0; i < calleeTy.paramTypes.length; i++) {
          let argTy = analyzeExpr(node.args[i], allowJump, funcSymbol, ctx);

          if (isPendingType(argTy)) {
            ctx.dispatchError('variable is not assigned yet.', node.args[i]);
            argTy = badType;
          }

          // if the argument returns nothing
          if (compareType(argTy, voidType) == 'compatible') {
            ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.args[i]);
            argTy = badType;
          }

          const paramTy = calleeTy.paramTypes[i];

          if (!isValidType(argTy) || !isValidType(paramTy)) {
            continue;
          }

          if (compareType(argTy, paramTy) == 'incompatible') {
            dispatchTypeError(argTy, paramTy, node.args[i], ctx);
          }
        }
      }

      ctx.symbolTable.set(node, new ExprSymbol(calleeTy.returnType));
      return calleeTy.returnType;
    }
    case 'BinaryOp': {
      let leftTy = analyzeExpr(node.left, allowJump, funcSymbol, ctx);
      let rightTy = analyzeExpr(node.right, allowJump, funcSymbol, ctx);

      // check assigned
      if (isPendingType(leftTy)) {
        ctx.dispatchError('variable is not assigned yet.', node.left);
        leftTy = badType;
      }
      if (isPendingType(rightTy)) {
        ctx.dispatchError('variable is not assigned yet.', node.right);
        rightTy = badType;
      }

      // if the expr returns nothing
      if (compareType(leftTy, voidType) == 'compatible') {
        ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.left);
        leftTy = badType;
      }
      if (compareType(rightTy, voidType) == 'compatible') {
        ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.right);
        rightTy = badType;
      }

      if (!isValidType(leftTy) || !isValidType(rightTy)) {
        return badType;
      }

      if (isLogicalBinaryOperator(node.operator)) {
        // Logical Operation
        if (compareType(leftTy, boolType) == 'incompatible') {
          dispatchTypeError(leftTy, boolType, node.left, ctx);
          return badType;
        }
        if (compareType(rightTy, boolType) == 'incompatible') {
          dispatchTypeError(rightTy, boolType, node.right, ctx);
          return badType;
        }

        ctx.symbolTable.set(node, new ExprSymbol(boolType));
        return boolType;
      } else if (isEquivalentOperator(node.operator)) {
        // Equivalent Operation
        if (compareType(rightTy, leftTy) == 'incompatible') {
          dispatchTypeError(rightTy, leftTy, node.right, ctx);
          return badType;
        }

        ctx.symbolTable.set(node, new ExprSymbol(boolType));
        return boolType;
      } else if (isOrderingOperator(node.operator)) {
        // Ordering Operation
        if (compareType(leftTy, numberType) == 'incompatible') {
          dispatchTypeError(leftTy, numberType, node.left, ctx);
        }
        if (compareType(rightTy, numberType) == 'incompatible') {
          dispatchTypeError(rightTy, numberType, node.right, ctx);
        }

        ctx.symbolTable.set(node, new ExprSymbol(boolType));
        return boolType;
      } else {
        // Arithmetic Operation
        if (compareType(leftTy, numberType) == 'incompatible') {
          dispatchTypeError(leftTy, numberType, node.left, ctx);
        }
        if (compareType(rightTy, numberType) == 'incompatible') {
          dispatchTypeError(rightTy, numberType, node.right, ctx);
        }

        ctx.symbolTable.set(node, new ExprSymbol(numberType));
        return numberType;
      }
      break;
    }
    case 'UnaryOp': {
      let ty = analyzeExpr(node.expr, allowJump, funcSymbol, ctx);

      // check assigned
      if (isPendingType(ty)) {
        ctx.dispatchError('variable is not assigned yet.', node.expr);
        ty = badType;
      }

      // if the expr returns nothing
      if (compareType(ty, voidType) == 'compatible') {
        ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
        ty = badType;
      }

      if (!isValidType(ty)) {
        return badType;
      }

      switch (node.operator) {
        case Token.Not: {
          if (compareType(ty, boolType) == 'incompatible') {
            dispatchTypeError(ty, boolType, node, ctx);
            return badType;
          }
          ctx.symbolTable.set(node, new ExprSymbol(boolType));
          return boolType;
        }
        case Token.Plus:
        case Token.Minus: {
          if (compareType(ty, numberType) == 'incompatible') {
            dispatchTypeError(ty, numberType, node, ctx);
            return badType;
          }
          ctx.symbolTable.set(node, new ExprSymbol(numberType));
          return numberType;
        }
      }
      break;
    }
    case 'StructExpr': {
      // get symbol
      const symbol = ctx.env.get(node.name);
      if (symbol == null) {
        ctx.dispatchError('unknown identifier.', node);
        return badType;
      }

      // expect struct symbol
      if (symbol.kind != 'StructSymbol') {
        ctx.dispatchError('struct expected.', node);
        return badType;
      }

      const defined: string[] = [];
      for (const fieldNode of node.fields) {
        // check already defined
        if (defined.indexOf(fieldNode.name) != -1) {
          ctx.dispatchError(`field \`${fieldNode.name}\` is duplicated.`, fieldNode);
        }
        defined.push(fieldNode.name);

        // analyze field
        let bodyTy = analyzeExpr(fieldNode.body, allowJump, funcSymbol, ctx);

        // TODO: check pending?

        // if the expr returns nothing
        if (compareType(bodyTy, voidType) == 'compatible') {
          ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, fieldNode.body);
          bodyTy = badType;
        }

        // get field symbol
        const fieldSymbol = symbol.fields.get(fieldNode.name)!;

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

      return new NamedType(symbol.name, symbol);
    }
    case 'ArrayNode': {
      // analyze elements
      for (const item of node.items) {
        analyzeExpr(item, allowJump, funcSymbol, ctx);

        // TODO: check type
      }

      // return expr type
      return arrayType;
    }
    case 'IfExpr': {
      let condTy = analyzeExpr(node.cond, allowJump, funcSymbol, ctx);
      const thenTy = analyzeBlock(node.thenBlock, allowJump, funcSymbol, ctx);
      const elseTy = analyzeBlock(node.elseBlock, allowJump, funcSymbol, ctx);

      // if the condition expr returned nothing
      if (compareType(condTy, voidType) == 'compatible') {
        ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.cond);
        condTy = badType;
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
        return badType;
      }

      return thenTy;
    }
  }
  throw new UguisuError('unexpected node');
}

// function getTypeFromSymbol(symbol: Symbol, errorNode: SyntaxNode, ctx: AnalyzeContext): Type {
//   switch (symbol.kind) {
//     case 'FuncSymbol':
//     case 'NativeFuncSymbol': {
//       return symbol.ty;
//     }
//     case 'StructSymbol': {
//       return new NamedType(symbol.name);
//     }
//     case 'VariableSymbol': {
//       return symbol.ty;
//     }
//     case 'ExprSymbol': {
//       return symbol.ty;
//     }
//   }
// }

function resolveTyLabel(node: TyLabel, ctx: AnalyzeContext): Type {
  // builtin type
  switch (node.name) {
    case 'number': {
      return numberType;
    }
    case 'bool': {
      return boolType;
    }
    case 'char': {
      return charType;
    }
    case 'string': {
      return stringType;
    }
    case 'array': {
      return arrayType;
    }
  }

  // try get user defined type
  const symbol = ctx.env.get(node.name);
  if (symbol == null) {
    ctx.dispatchError('unknown type name.', node);
    return badType;
  }

  switch (symbol.kind) {
    case 'StructSymbol': {
      return new NamedType(symbol.name, symbol);
    }
    case 'StructFieldSymbol':
    case 'FuncSymbol':
    case 'NativeFuncSymbol':
    case 'VariableSymbol':
    case 'ExprSymbol': {
      ctx.dispatchError('invalid type name.', node);
      return badType;
    }
  }
}
