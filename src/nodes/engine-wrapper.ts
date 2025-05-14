import { connect, StringCodec, Subscription } from 'nats';

const sc = StringCodec();

async function startTranslator(translatorId: string) {
    const nc = await connect({ servers: 'nats://localhost:4222' });
    console.log(`Translator ${translatorId} connected`);

    let isLeader = false;
    let currentLeader: { translatorId: string; claimedAt: number } | null = null;
    const messageBuffer: { id: string; translated: any }[] = [];
    const healthStatus: { [id: string]: { timestamp: number } } = {};

    // Subscribe to leader election, raw messages, and health
    const leaderSub: Subscription = nc.subscribe('leader.election');
    const msgSub = nc.subscribe('raw.messages');
    const healthSub = nc.subscribe('health.status');8

    // Health heartbeat every 2 seconds
    const reportHealth = async () => {
        const status = { translatorId, timestamp: Date.now() };
        nc.publish('health.status', sc.encode(JSON.stringify(status)));
        // console.log(`Translator ${translatorId} reported health`);
    };
    reportHealth();
    const healthInterval = setInterval(reportHealth, 2000);

    // Monitor health
    const monitorHealth = async () => {
        for await (const msg of healthSub) {
            const status = JSON.parse(sc.decode(msg.data));
            healthStatus[status.translatorId] = { timestamp: status.timestamp };
        }
    };
    monitorHealth();

    // Wait for at least one heartbeat interval before attempting leadership
    await new Promise(resolve => setTimeout(resolve, 2200));
    // Actively process health and leader messages for a short period before attempting leadership
    const primeStart = Date.now();
    while (Date.now() - primeStart < 1500) {
        // Let the event loop process other tasks
        await new Promise(res => setTimeout(res, 50));
    }
    // Log healthStatus after priming
    console.log(`Translator ${translatorId} healthStatus after priming:`, JSON.stringify(healthStatus));
    // If no other healthy engines detected, wait again and prime again before claiming leadership
    if (Object.keys(healthStatus).filter(id => id !== translatorId).length === 0) {
        console.log(`Translator ${translatorId} did not detect other engines, waiting and priming again before claiming leadership...`);
        await new Promise(resolve => setTimeout(resolve, 2200));
        const primeStart2 = Date.now();
        while (Date.now() - primeStart2 < 1500) {
            await new Promise(res => setTimeout(res, 50));
        }
        console.log(`Translator ${translatorId} healthStatus after second priming:`, JSON.stringify(healthStatus));
    }

    // Leader election
    const attemptLeadership = async () => {
        const now = Date.now();
        // If there is no current leader at all, or the leader is unhealthy, claim leadership
        if (!currentLeader || !currentLeader.translatorId || !healthStatus[currentLeader.translatorId] || (now - healthStatus[currentLeader.translatorId].timestamp >= 5000)) {
            const claim = { translatorId, claimedAt: now };
            nc.publish('leader.election', sc.encode(JSON.stringify(claim)));
            console.log(`Translator ${translatorId} claimed leadership`);
        }
    };

    const monitorLeadership = async () => {
        for await (const msg of leaderSub) {
            const claim = JSON.parse(sc.decode(msg.data));
            // Deterministic leader selection: earliest claimedAt, tie-breaker by lowest translatorId
            let prevLeaderHealthy = false;
            if (currentLeader && healthStatus[currentLeader.translatorId]) {
                const lastHeartbeat = healthStatus[currentLeader.translatorId].timestamp;
                prevLeaderHealthy = (Date.now() - lastHeartbeat) < 5000;
            }
            // Accept new leader if:
            // 1. There is no current leader
            // 2. The previous leader is unhealthy
            // 3. The new claim is better (earlier claimedAt or lower translatorId)
            if (!currentLeader || !prevLeaderHealthy || claim.claimedAt < currentLeader.claimedAt ||
                (claim.claimedAt === currentLeader.claimedAt && claim.translatorId < currentLeader.translatorId)) {
                currentLeader = claim;
            }
            const wasLeader = isLeader;
            isLeader = !!currentLeader && currentLeader.translatorId === translatorId;
            if (isLeader && !wasLeader) {
                if (messageBuffer.length > 0) {
                    for (const { translated } of messageBuffer) {
                        nc.publish('translated.messages', sc.encode(JSON.stringify(translated)));
                        console.log(`Translator ${translatorId} (new leader) published buffered: ${translated.payload}`);
                    }
                    messageBuffer.length = 0;
                } else {
                    console.log(`Translator ${translatorId} (new leader) has no buffered messages to publish.`);
                }
            }
            // If the current leader is unhealthy, trigger a new leadership attempt for all
            if (currentLeader && healthStatus[currentLeader.translatorId]) {
                const now = Date.now();
                const lastHeartbeat = healthStatus[currentLeader.translatorId].timestamp;
                if (now - lastHeartbeat >= 5000) {
                    setTimeout(attemptLeadership, 0); // All engines should attempt leadership
                }
            }
            console.log(`Translator ${translatorId} ${isLeader ? 'is leader' : 'follows leader'} ${currentLeader ? currentLeader.translatorId : 'no leader'}`);
        }
    };
    monitorLeadership();

    setInterval(attemptLeadership, 6000);
    attemptLeadership();

    // Periodically re-publish leadership claim if this engine is the leader
    setInterval(() => {
        if (isLeader) {
            const claim = { translatorId, claimedAt: currentLeader ? currentLeader.claimedAt : Date.now() };
            nc.publish('leader.election', sc.encode(JSON.stringify(claim)));
            // Optionally log this for debugging
            // console.log(`Translator ${translatorId} (leader) re-published leadership claim`);
        }
    }, 3000); // every 3 seconds

    // Process messages
    for await (const msg of msgSub) {
        try {
            const message = JSON.parse(sc.decode(msg.data));
            // Only the leader publishes
            const translated = { id: message.id, payload: `Translated: ${message.payload}` };
            if (isLeader) {
                nc.publish('translated.messages', sc.encode(JSON.stringify(translated)));
                console.log(`Translator ${translatorId} (leader) published: ${translated.payload}`);
            } else {
                messageBuffer.push({ id: message.id, translated });
                // Keep buffer small (e.g., last 100 messages)
                if (messageBuffer.length > 100) messageBuffer.shift();
            }
        } catch (err) {
            console.error(`Translator ${translatorId} error:`, err);
        }
    }

    clearInterval(healthInterval);
    await nc.closed();
}

// Parse ENGINE_ID from command line arguments
function getEngineId(): string {
    const arg = process.argv.find(a => a.startsWith('--ENGINE_ID'));
    if (arg) {
        const parts = arg.split('=');
        if (parts.length === 2) return parts[1];
        // Support --ENGINE_ID engine1
        const idx = process.argv.indexOf(arg);
        if (process.argv[idx + 1]) return process.argv[idx + 1];
    }
    return 'unknown';
}

startTranslator(getEngineId()).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});