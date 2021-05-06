import 'mocha';
import {assert} from 'chai';

describe('basic tests', () => {
    it('runs the tests', () => {
        assert.equal(1, 1, 'simple equality');
    });
    it('has types', () => {

        const foo: number = 1;
        assert.equal(1, foo, 'simple equality');
    });
});
