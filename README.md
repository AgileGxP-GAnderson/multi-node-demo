# NATS Monitoring System

This project implements a multi-node monitoring system using NATS for messaging. It allows for the management and monitoring of nodes in a distributed environment.

## Project Structure

```
multi-node-demo
├── src
│   ├── index.ts               # Entry point of the application
│   ├── config
│   │   └── natsConfig.ts      # Configuration for NATS connection
│   ├── nodes
│   │   └── nodeManager.ts      # Manages nodes in the system
│   ├── monitoring
│   │   └── monitor.ts          # Monitors the nodes
│   └── types
│       └── index.ts            # Type definitions for nodes and monitoring config
├── package.json                # NPM package configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/nats-monitoring-system.git
   cd nats-monitoring-system
   ```

2. Install the dependencies:
   ```
   npm install
   ```

## Usage

To start the monitoring system, run the following commands:
```
-- Start NATS
nats-server.exe

-- Start engine wrappers.  Name as you will
npx ts-node src\nodes\engine-wrapper.ts --name engine1
npx ts-node src\nodes\engine-wrapper.ts --name engine2

-- Start subscriber 
npx ts-node src\nodes\subscriber.ts

-- Start publisher
npx ts-node src\nodes\publisher.ts

-- Start health monitor
npx ts-node src\nodes\health-monitor.ts

-- Optional : to 'spy' on NATS message for troubleshooting:
npx ts-node src\nodes\sniffer.ts

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.