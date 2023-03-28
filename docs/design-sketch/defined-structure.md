```
interface Position {
  fn getX(): number;
  fn getY(): number;
}

interface Drawable {
  fn draw();
}

struct Player {
  name: string,
  x: number,
  y: number,
}

impl Player {
  fn getName(): number {
    return this.name;
  }
}

impl Player : Position {
  fn getX(): number {
    return this.x;
  }

  fn getY(): number {
    return this.y;
  }
}

impl Player : Drawable {
  fn draw() {
    // ...
  }
}

fn showCharInfo(char: Position & Drawable) {
  print(char.getX());
  print(char.getY());
  print(char.draw());
}

fn main() {
  var player = new Player {
    name: "you",
    x: 0,
    y: 0,
  };
  printStr(player.getName());
  showCharInfo(player);
}
```
