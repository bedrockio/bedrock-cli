import path from 'path';
import { homedir } from 'os';
import { getWrittenData } from 'util/file';
import { loginWithPassword } from '../index';

jest.mock('util/file');

describe('loginWithPassword', () => {

  it('should write to crendentials file on login with password', async () => {
    await loginWithPassword({
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
