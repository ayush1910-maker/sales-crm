import { MongoMemoryServer } from 'mongodb-memory-server';

console.log('Starting local dev in-memory MongoDB instance on port 27017...');

try {
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbName: 'sales_crm',
      ip: '127.0.0.1',
    },
  });

  const uri = mongod.getUri();
  console.log(`MongoDB dev instance successfully running at: ${uri}`);
  console.log('Press Ctrl+C to terminate.');

  const cleanup = async () => {
    console.log('Stopping dev MongoDB instance...');
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
} catch (err) {
  console.error('Failed to start in-memory MongoDB:', err.message);
  process.exit(1);
}
