// TODO

type Path = {
	handler: () => void,
};

function apply(pathes: Path[]) {
	for (const path of pathes) {
		path.handler();
	}
}
