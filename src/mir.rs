pub enum PrimitiveType {
	Number,
	Float,
	//String,
}

pub enum ReturnValue {
	None,
	Value(PrimitiveType),
}
