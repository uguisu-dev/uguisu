use crate::errors::CompileError;
use crate::{ast, hir};

pub fn analyze(ast: &Vec<ast::Statement>) -> Result<Vec<hir::FunctionDeclaration>, CompileError> {
    let lowering = AstLowering::new();
    let func_decls = lowering.translate(ast)?;
    Ok(func_decls)
}

struct AstLowering {}

impl AstLowering {
    pub fn new() -> Self {
        Self {}
    }

    pub fn translate(
        &self,
        ast: &Vec<ast::Statement>,
    ) -> Result<Vec<hir::FunctionDeclaration>, CompileError> {
        let func_decls = Vec::new();
        for statement in ast.iter() {
            match statement {
                ast::Statement::FunctionDeclaration(func_decl) => {
                    func_decls.push(self.translate_func_decl(func_decl)?);
                }
                _ => {}
            }
        }
        Ok(func_decls)
    }

    fn translate_func_decl(
        &self,
        node: &ast::FunctionDeclaration,
    ) -> Result<hir::FunctionDeclaration, CompileError> {
        let func_decl = hir::FunctionDeclaration {
            identifier: node.identifier,
            param_names: Vec::new(),
            param_kinds: Vec::new(),
            return_kind: None,
            body: None,
            attributes: Vec::new(),
        };
        for param in node.params.iter() {
            let param_type = match &param.type_identifier {
                Some(type_name) => {
                    // TODO: support other types
                    if type_name != "number" {
                        return Err(CompileError::new("unknown type"));
                    }
                    hir::ValueKind::Number
                }
                None => return Err(CompileError::new("Parameter type is not specified.")),
            };
            func_decl.param_names.push(param.identifier.clone());
            func_decl.param_kinds.push(param_type);
        }
        func_decl.return_kind = match &node.ret {
            Some(type_name) => {
                // TODO: support other types
                if type_name != "number" {
                    return Err(CompileError::new("unknown type"));
                }
                Some(hir::ValueKind::Number)
            }
            None => None,
        };
        if let Some(body) = &node.body {
            for statement in body.iter() {
                self.translate_statement(statement);
            }
        }
        Ok(func_decl)
    }

    fn translate_statement(&self, node: &ast::Statement) {
        // TODO
    }
}
