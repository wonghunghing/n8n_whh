import { ApplicationError } from 'n8n-workflow';
import { createServer } from 'node:http';

export class TaskRunnerServer {
	private server = createServer((_, res) => {
		res.writeHead(200);
		res.end('OK');
	});

	async start(host: string, port: number) {
		return await new Promise<void>((resolve, reject) => {
			this.server.listen(port, host, () => {
				console.log(`Task runner server listening on ${host}, port ${port}`);
				resolve();
			});

			this.server.on('error', (error: NodeJS.ErrnoException) => {
				if (error.code === 'EADDRINUSE') {
					reject(new ApplicationError(`Port ${port} is already in use`));
				} else {
					reject(error);
				}
			});
		});
	}

	async stop() {
		return await new Promise<void>((resolve) => {
			this.server.close(() => resolve());
		});
	}
}
