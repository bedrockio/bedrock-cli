import path from 'path';
import { homedir } from 'os';
import { getWrittenData } from 'util/file';
import { login } from '../index';

jest.mock('util/file');

describe('login', () => {

  it('should write to crendentials file from login', async () => {
    await login({
      email: 'fake@email.com',
      password: 'fakepassword',
    });
    expect(getWrittenData(path.resolve(homedir(), '.bedrock', 'credentials.json'))).toEqual({
      id: {
        name: 'User',
        email: 'fake@email.com',
        token: 'token'
      },
      current: 'id'
    });
  });

});
