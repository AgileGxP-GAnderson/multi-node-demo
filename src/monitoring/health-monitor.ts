import { connect, StringCodec } from 'nats';

const sc = StringCodec();
const healthStatus: { [id: string]: { timestamp: number } } = {};
let currentLeader: string | null = null;

async function startHealthMonitor() {
    const nc = await connect({ servers: 'nats://localhost:4222' });
    console.log('Health monitor connected');

    // Monitor health
    const healthSub = nc.subscribe('health.status');
    const monitorHealth = async () => {
        for await (const msg of healthSub) {
            const status = JSON.parse(sc.decode(msg.data));
            healthStatus[status.translatorId] = { timestamp: status.timestamp };
        }
    };
    monitorHealth();

    // Monitor leader
    const leaderSub = nc.subscribe('leader.election');
    const monitorLeader = async () => {
        for await (const msg of leaderSub) {
            const claim = JSON.parse(sc.decode(msg.data));
            currentLeader = claim.translatorId;
        }
    };
    monitorLeader();

    // Report health
    const reportHealthy = () => {
        const now = Date.now();
        const healthyTranslators = Object.entries(healthStatus)
            .filter(([_, status]) => now - status.timestamp < 20000)
            .map(([translatorId]) => translatorId);
        console.log(`Healthy translators (${healthyTranslators.length}):`, healthyTranslators);
        console.log(`Current leader: ${currentLeader || 'none'}`);
    };
    setInterval(reportHealthy, 15000);

    await nc.closed();
}

startHealthMonitor().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});