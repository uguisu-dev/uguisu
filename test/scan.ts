import assert from 'assert';
import { LiteralKind, LiteralValue, Scanner, Token } from '../src/lib/syntax/scan.js';

function setupTest(input: string) {
    const s = new Scanner();
    s.setup(input);
    s.next();
    return s;
}

function assertToken(s: Scanner, token: Token) {
    assert.strictEqual(s.getToken(), token);
}

function assertLiteralToken(s: Scanner, kind: LiteralKind, value: string) {
    assertToken(s, Token.Literal);
    assert.deepStrictEqual(s.getLiteralValue(), { kind, value } as LiteralValue);
}

test('eof', () => {
    const input = '';
    const s = setupTest(input);
    assertToken(s, Token.EOF);
    s.next();
    assertToken(s, Token.EOF);
});

test('identifier', () => {
    const input = 'aaa123 xyz456';
    const s = setupTest(input);
    assertToken(s, Token.Ident);
    assert.strictEqual(s.getIdentValue(), 'aaa123');
    s.next();
    assertToken(s, Token.Ident);
    assert.strictEqual(s.getIdentValue(), 'xyz456');
    s.next();
    assertToken(s, Token.EOF);
});

describe('literal token', () => {
    test('number literal', () => {
        const input = '123 456';
        const s = setupTest(input);
        assertLiteralToken(s, 'number', '123');
        s.next();
        assertLiteralToken(s, 'number', '456');
        s.next();
        assertToken(s, Token.EOF);
    });

    test('string literal', () => {
        const input = '"abc123" "xyz456"';
        const s = setupTest(input);
        assertLiteralToken(s, 'string', 'abc123');
        s.next();
        assertLiteralToken(s, 'string', 'xyz456');
        s.next();
        assertToken(s, Token.EOF);
    });

    test('bool literal', () => {
        const input = 'true false';
        const s = setupTest(input);
        assertLiteralToken(s, 'bool', 'true');
        s.next();
        assertLiteralToken(s, 'bool', 'false');
        s.next();
        assertToken(s, Token.EOF);
    });
});

describe('token sequence', () => {
    test('add expr', () => {
        const input = '1 + 2';
        const s = setupTest(input);
        assertLiteralToken(s, 'number', '1');
        s.next();
        assertToken(s, Token.Plus);
        s.next();
        assertLiteralToken(s, 'number', '2');
        s.next();
        assertToken(s, Token.EOF);
    });

    test('if statement', () => {
        const input = 'if x { } else { }';
        const s = setupTest(input);
        assertToken(s, Token.If);
        s.next();
        assertToken(s, Token.Ident);
        assert.strictEqual(s.getIdentValue(), 'x');
        s.next();
        assertToken(s, Token.BeginBrace);
        s.next();
        assertToken(s, Token.EndBrace);
        s.next();
        assertToken(s, Token.Else);
        s.next();
        assertToken(s, Token.BeginBrace);
        s.next();
        assertToken(s, Token.EndBrace);
        s.next();
        assertToken(s, Token.EOF);
    });
});
