import fs from 'fs';

import * as utils from '../utils';

jest.mock('fs');

describe('cloud utils', () => {
  it('should update service yaml env', async () => {
    const apiYamlFileString = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deployment
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - image: gcr.io/bedrock-foundation/bedrock-cli-services-api
          imagePullPolicy: Always
          name: main
          env:
            - name: NODE_ENV
              value: "staging"
            - name: MONGO_URI
              value: "mongodb://mongo:27017/bedrock_staging"
            - name: ADMIN_EMAIL
              value: "admin@bedrock.foundation"
            - name: APP_DOMAIN
              value: "bedrock.foundation"
            - name: JWT_SECRET
              value: "changeme1234"
            - name: APP_URL
              value: "https://bedrock.foundation"
            - name: POSTMARK_FROM
              value: "no-reply@bedrock.foundation"
            - name: POSTMARK_APIKEY
              value: "abc"
            - name: UPLOADS_STORE
              value: "gcs"
            - name: UPLOADS_GCS_BUCKET
              value: "bedrock-staging-uploads"
          ports:
            - name: http-server
              containerPort: 2300
          volumeMounts:
            - name: cache
              mountPath: /service/data
      volumes:
        - name: cache
          emptyDir: {}`;
    const filename = 'test-api-deployment.yml';
    const environment = 'staging';
    const service = 'api';

    let updated = apiYamlFileString;
    fs.readFileSync.mockImplementation(() => {
      return updated;
    });

    fs.writeFileSync.mockImplementation((str, content) => {
      updated = content;
    });

    const deployment = utils.readServiceYaml(environment, service);
    expect(deployment.spec.template.spec.containers[0].env.length).toBe(10);

    utils.updateServiceYamlEnv(environment, service, 'JWT_SECRET', `changed`);
    utils.updateServiceYamlEnv(environment, service, 'NODE_ENV', `demo`);
    utils.updateServiceYamlEnv(environment, service, 'DOES_NOT_EXIST', `nope`);

    expect(updated.trim()).toBe(
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deployment
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - image: gcr.io/bedrock-foundation/bedrock-cli-services-api
          imagePullPolicy: Always
          name: main
          env:
            - name: NODE_ENV
              value: demo
            - name: MONGO_URI
              value: mongodb://mongo:27017/bedrock_staging
            - name: ADMIN_EMAIL
              value: admin@bedrock.foundation
            - name: APP_DOMAIN
              value: bedrock.foundation
            - name: JWT_SECRET
              value: changed
            - name: APP_URL
              value: https://bedrock.foundation
            - name: POSTMARK_FROM
              value: no-reply@bedrock.foundation
            - name: POSTMARK_APIKEY
              value: abc
            - name: UPLOADS_STORE
              value: gcs
            - name: UPLOADS_GCS_BUCKET
              value: bedrock-staging-uploads
          ports:
            - name: http-server
              containerPort: 2300
          volumeMounts:
            - name: cache
              mountPath: /service/data
      volumes:
        - name: cache
          emptyDir: {}
`.trim()
    );

    const updatedDeployment = utils.readServiceYaml(environment, filename);
    expect(updatedDeployment.spec.template.spec.containers[0].env.length).toBe(10);
  });
});
