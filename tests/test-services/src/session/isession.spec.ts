// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { expect } from 'chai';

import { PageConfig } from '@jupyterlab/coreutils';

import { UUID } from '@phosphor/coreutils';

import { Signal } from '@phosphor/signaling';

import { Kernel, KernelMessage } from '@jupyterlab/services/src/kernel';

import { Session } from '@jupyterlab/services/src/session';

import {
  expectFailure,
  handleRequest,
  SessionTester,
  init,
  testEmission
} from '../utils';

init();

/**
 * Start a new session with a unique name.
 */
function startNew(): Promise<Session.ISession> {
  return Session.startNew({ path: UUID.uuid4() });
}

describe('session', () => {
  let session: Session.ISession;
  let defaultSession: Session.ISession;

  beforeAll(async () => {
    defaultSession = await startNew();
    await defaultSession.kernel.ready;
  });

  afterEach(async () => {
    if (session && !session.isDisposed) {
      await session.kernel.ready;
      await session.shutdown();
    }
  });

  afterAll(async () => {
    await defaultSession.kernel.ready;
    await defaultSession.shutdown();
  });

  describe('Session.ISession', () => {
    describe('#terminated', () => {
      it('should emit when the session is shut down', async () => {
        let called = false;
        session = await startNew();
        await session.kernel.ready;
        session.terminated.connect(() => {
          called = true;
        });
        await session.shutdown();
        session.dispose();
        expect(called).to.equal(true);
      });
    });

    describe('#kernelChanged', () => {
      it('should emit when the kernel changes', async () => {
        let called: Session.IKernelChangedArgs | null = null;
        const object = {};
        defaultSession.kernelChanged.connect(
          (s, args) => {
            called = args;
            Signal.disconnectReceiver(object);
          },
          object
        );
        const previous = defaultSession.kernel;
        await defaultSession.changeKernel({ name: previous.name });
        await defaultSession.kernel.ready;
        expect(previous).to.not.equal(defaultSession.kernel);
        expect(called).to.deep.equal({
          oldValue: previous,
          newValue: defaultSession.kernel
        });
        previous.dispose();
      });
    });

    describe('#statusChanged', () => {
      it('should emit when the kernel status changes', async () => {
        let called = false;
        defaultSession.statusChanged.connect((s, status) => {
          if (status === 'busy') {
            called = true;
          }
        });
        await defaultSession.kernel.requestKernelInfo();
        expect(called).to.equal(true);
      });
    });

    describe('#iopubMessage', () => {
      it('should be emitted for an iopub message', async () => {
        let called = false;
        defaultSession.iopubMessage.connect((s, msg) => {
          if (msg.header.msg_type === 'status') {
            called = true;
          }
        });
        await defaultSession.kernel.requestExecute({ code: 'a=1' }, true).done;
        expect(called).to.equal(true);
      });
    });

    describe('#unhandledMessage', () => {
      it('should be emitted for an unhandled message', async () => {
        const tester = new SessionTester();
        const session = await tester.startSession();
        await session.kernel.ready;
        const msgId = UUID.uuid4();
        const emission = testEmission(session.unhandledMessage, {
          find: (k, msg) => msg.header.msg_id === msgId
        });
        const msg = KernelMessage.createShellMessage({
          msgType: 'foo',
          channel: 'shell',
          session: tester.serverSessionId,
          msgId
        });
        msg.parent_header = { session: session.kernel.clientId };
        tester.send(msg);
        await emission;
        await tester.shutdown();
        tester.dispose();
      });
    });

    describe('#propertyChanged', () => {
      it('should be emitted when the session path changes', async () => {
        const newPath = UUID.uuid4();
        let called = false;
        const object = {};
        defaultSession.propertyChanged.connect(
          (s, type) => {
            expect(defaultSession.path).to.equal(newPath);
            expect(type).to.equal('path');
            called = true;
            Signal.disconnectReceiver(object);
          },
          object
        );
        await defaultSession.setPath(newPath);
        expect(called).to.equal(true);
      });
    });

    describe('#id', () => {
      it('should be a string', () => {
        expect(typeof defaultSession.id).to.equal('string');
      });
    });

    describe('#path', () => {
      it('should be a string', () => {
        expect(typeof defaultSession.path).to.equal('string');
      });
    });

    describe('#name', () => {
      it('should be a string', () => {
        expect(typeof defaultSession.name).to.equal('string');
      });
    });

    describe('#type', () => {
      it('should be a string', () => {
        expect(typeof defaultSession.name).to.equal('string');
      });
    });

    describe('#model', () => {
      it('should be an IModel', () => {
        const model = defaultSession.model;
        expect(typeof model.id).to.equal('string');
        expect(typeof model.path).to.equal('string');
        expect(typeof model.kernel.name).to.equal('string');
        expect(typeof model.kernel.id).to.equal('string');
      });
    });

    describe('#kernel', () => {
      it('should be an IKernel object', () => {
        expect(typeof defaultSession.kernel.id).to.equal('string');
      });
    });

    describe('#kernel', () => {
      it('should be a delegate to the kernel status', () => {
        expect(defaultSession.status).to.equal(defaultSession.kernel.status);
      });
    });

    describe('#serverSettings', () => {
      it('should be the serverSettings', () => {
        expect(defaultSession.serverSettings.baseUrl).to.equal(
          PageConfig.getBaseUrl()
        );
      });
    });

    describe('#isDisposed', () => {
      it('should be true after we dispose of the session', () => {
        const session = Session.connectTo(defaultSession.model);
        expect(session.isDisposed).to.equal(false);
        session.dispose();
        expect(session.isDisposed).to.equal(true);
      });

      it('should be safe to call multiple times', () => {
        const session = Session.connectTo(defaultSession.model);
        expect(session.isDisposed).to.equal(false);
        expect(session.isDisposed).to.equal(false);
        session.dispose();
        expect(session.isDisposed).to.equal(true);
        expect(session.isDisposed).to.equal(true);
      });
    });

    describe('#dispose()', () => {
      it('should dispose of the resources held by the session', () => {
        const session = Session.connectTo(defaultSession.model);
        session.dispose();
        expect(session.isDisposed).to.equal(true);
      });

      it('should be safe to call twice', () => {
        const session = Session.connectTo(defaultSession.model);
        session.dispose();
        expect(session.isDisposed).to.equal(true);
        session.dispose();
        expect(session.isDisposed).to.equal(true);
      });

      it('should be safe to call if the kernel is disposed', () => {
        const session = Session.connectTo(defaultSession.model);
        session.kernel.dispose();
        session.dispose();
        expect(session.isDisposed).to.equal(true);
      });
    });

    describe('#setPath()', () => {
      it('should set the path of the session', async () => {
        const newPath = UUID.uuid4();
        await defaultSession.setPath(newPath);
        expect(defaultSession.path).to.equal(newPath);
      });

      it('should fail for improper response status', async () => {
        handleRequest(defaultSession, 201, {});
        await expectFailure(defaultSession.setPath(UUID.uuid4()));
      });

      it('should fail for error response status', async () => {
        handleRequest(defaultSession, 500, {});
        await expectFailure(defaultSession.setPath(UUID.uuid4()), '');
      });

      it('should fail for improper model', async () => {
        handleRequest(defaultSession, 200, {});
        await expectFailure(defaultSession.setPath(UUID.uuid4()));
      });

      it('should fail if the session is disposed', async () => {
        const session = Session.connectTo(defaultSession.model);
        session.dispose();
        const promise = session.setPath(UUID.uuid4());
        await expectFailure(promise, 'Session is disposed');
      });
    });

    describe('#setType()', () => {
      it('should set the type of the session', async () => {
        const type = UUID.uuid4();
        await defaultSession.setType(type);
        expect(defaultSession.type).to.equal(type);
      });

      it('should fail for improper response status', async () => {
        handleRequest(defaultSession, 201, {});
        await expectFailure(defaultSession.setType(UUID.uuid4()));
      });

      it('should fail for error response status', async () => {
        handleRequest(defaultSession, 500, {});
        await expectFailure(defaultSession.setType(UUID.uuid4()), '');
      });

      it('should fail for improper model', async () => {
        handleRequest(defaultSession, 200, {});
        await expectFailure(defaultSession.setType(UUID.uuid4()));
      });

      it('should fail if the session is disposed', async () => {
        const session = Session.connectTo(defaultSession.model);
        session.dispose();
        const promise = session.setPath(UUID.uuid4());
        await expectFailure(promise, 'Session is disposed');
      });
    });

    describe('#setName()', () => {
      it('should set the name of the session', async () => {
        const name = UUID.uuid4();
        await defaultSession.setName(name);
        expect(defaultSession.name).to.equal(name);
      });

      it('should fail for improper response status', async () => {
        handleRequest(defaultSession, 201, {});
        await expectFailure(defaultSession.setName(UUID.uuid4()));
      });

      it('should fail for error response status', async () => {
        handleRequest(defaultSession, 500, {});
        await expectFailure(defaultSession.setName(UUID.uuid4()), '');
      });

      it('should fail for improper model', async () => {
        handleRequest(defaultSession, 200, {});
        await expectFailure(defaultSession.setName(UUID.uuid4()));
      });

      it('should fail if the session is disposed', async () => {
        const session = Session.connectTo(defaultSession.model);
        session.dispose();
        const promise = session.setPath(UUID.uuid4());
        await expectFailure(promise, 'Session is disposed');
      });
    });

    describe('#changeKernel()', () => {
      it('should create a new kernel with the new name', async () => {
        session = await startNew();
        const previous = session.kernel;
        await previous.ready;
        await session.changeKernel({ name: previous.name });
        await session.kernel.ready;
        expect(session.kernel.name).to.equal(previous.name);
        expect(session.kernel.id).to.not.equal(previous.id);
        expect(session.kernel).to.not.equal(previous);
        previous.dispose();
      });

      it('should accept the id of the new kernel', async () => {
        session = await startNew();
        const previous = session.kernel;
        await previous.ready;
        const kernel = await Kernel.startNew();
        await kernel.ready;
        await session.changeKernel({ id: kernel.id });
        await session.kernel.ready;
        expect(session.kernel.id).to.equal(kernel.id);
        expect(session.kernel).to.not.equal(previous);
        expect(session.kernel).to.not.equal(kernel);
        previous.dispose();
        kernel.dispose();
      });

      it('should update the session path if it has changed', async () => {
        session = await startNew();
        const previous = session.kernel;
        await previous.ready;
        const model = { ...session.model, path: 'foo.ipynb' };
        handleRequest(session, 200, model);
        await session.changeKernel({ name: previous.name });
        await session.kernel.ready;
        expect(session.kernel.name).to.equal(previous.name);
        expect(session.path).to.equal(model.path);
        previous.dispose();
      });
    });

    describe('#shutdown()', () => {
      it('should shut down properly', async () => {
        session = await startNew();
        await session.shutdown();
      });

      it('should emit a terminated signal', async () => {
        let called = false;
        session = await startNew();
        session.terminated.connect(() => {
          called = true;
        });
        await session.shutdown();
        expect(called).to.equal(true);
      });

      it('should fail for an incorrect response status', async () => {
        handleRequest(defaultSession, 200, {});
        await expectFailure(defaultSession.shutdown());
      });

      it('should handle a 404 status', async () => {
        session = await startNew();
        handleRequest(session, 404, {});
        await session.shutdown();
      });

      it('should handle a specific error status', async () => {
        handleRequest(defaultSession, 410, {});
        let promise = defaultSession.shutdown();
        try {
          await promise;
          throw Error('should not get here');
        } catch (err) {
          const text = 'The kernel was deleted but the session was not';
          expect(err.message).to.contain(text);
        }
      });

      it('should fail for an error response status', async () => {
        handleRequest(defaultSession, 500, {});
        await expectFailure(defaultSession.shutdown(), '');
      });

      it('should fail if the session is disposed', async () => {
        const session = Session.connectTo(defaultSession.model);
        session.dispose();
        await expectFailure(session.shutdown(), 'Session is disposed');
      });

      it('should dispose of all session instances', async () => {
        const session0 = await startNew();
        const session1 = Session.connectTo(session0.model);
        await session0.shutdown();
        expect(session1.isDisposed).to.equal(true);
      });
    });
  });
});
