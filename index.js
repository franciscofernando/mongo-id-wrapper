module.exports = (mongoClient, intents = 5) => {
  const evaluator = (docs) => {
    function* validateExistence() {
      let id = new MongoClient.ObjectId();
      for (let i = 0; i < intents; i++) {
        yield mongoClient.findOne({ _id: id })
          .then((res) => {
            if (res) {
              id = new MongoClient.ObjectId();
              return false;
            } else {
              throw 'Existis _id';
            }
          })
          .catch(() => {
            return id;
          });
      }
    }

    return new Promise((resolve, reject) => {
      const docsAux = Array.isArray(docs) ? docs : [docs];
      Promise.all(
        docsAux.map(async doc => {
          for await (let id of validateExistence()) {
            if (id) {
              return {
                _id: id,
                ...doc
              };
            }
          }
        })
      )
        .then((validatedDocs) => {
          return Array.isArray(docs) ? validatedDocs : validatedDocs[0];
        })
        .then(resolve)
        .catch(reject);
    });
  };

  ['insert', 'insertMany', 'insertOne'].forEach(methodName => {
    const originalMethod = mongoClient[methodName];
    mongoClient[methodName] = ((docs, options, callback) => {
      return new Promise((resolve, reject) => {
        evaluator(docs)
          .then((docs) => {
            originalMethod.bind(mongoClient)(docs, options, callback)
              .then(resolve)
              .catch(reject);
          })
          .catch(reject);
      });
    }).bind(mongoClient);
  });

  return mongoClient;
};