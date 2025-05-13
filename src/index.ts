import { connect, NatsConnection } from 'nats';
import natsConfig from './config/natsConfig';
import { startHealthMonitor } from './monitoring/health-monitor';

async function main() {
    const nc: NatsConnection = await connect(natsConfig);
    console.log('Connected to NATS server');

    await startHealthMonitor();

    process.on('SIGINT', async () => {
        console.log('Shutting down...');
        await nc.close();
        process.exit();
    });
}

main().catch(err => {
    console.error('Error starting the application:', err);
});