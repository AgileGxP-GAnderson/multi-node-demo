export interface Node {
    id: string;
    name: string;
    status: 'active' | 'inactive' | 'failed';
    lastHeartbeat: Date;
}

export interface MonitorConfig {
    interval: number; // in milliseconds
    alertThreshold: number; // number of missed heartbeats before alerting
}