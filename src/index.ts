import { connect, NatsConnection } from 'nats';
import { natsConfig } from './config/natsConfig';
import { NodeManager } from './nodes/nodeManager';
import { Monitor } from './monitoring/monitor';

async function main() {
    const nc: NatsConnection = await connect(natsConfig);
    console.log('Connected to NATS server');

    const nodeManager = new NodeManager();
    const monitor = new Monitor(nodeManager);

    monitor.startMonitoring();

    process.on('SIGINT', async () => {
        console.log('Shutting down...');
        await monitor.stopMonitoring();
        await nc.close();
        process.exit();
    });
}

main().catch(err => {
    console.error('Error starting the application:', err);
});