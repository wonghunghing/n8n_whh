import { Container } from '@n8n/di';
import { Flags } from '@oclif/core';

import { type InstalledNodes } from '@/databases/entities/installed-nodes';
import { InstalledNodesRepository } from '@/databases/repositories/installed-nodes.repository';
import { InstalledPackagesRepository } from '@/databases/repositories/installed-packages.repository';

import { BaseCommand } from './base-command';

export class CommunityNode extends BaseCommand {
	static description = '\nInstall and uninstall a community node';

	static examples = ['$ n8n node --uninstall --type n8n-nodes-evolution-api'];

	static flags = {
		help: Flags.help({ char: 'h' }),
		uninstall: Flags.boolean({
			description: 'Uninstalls the node',
		}),
		package: Flags.string({
			description: 'Package name of the community node.',
		}),
		rawOutput: Flags.boolean({
			description: 'Outputs only JSON data, with no other text',
		}),
	};

	async init() {
		await super.init();
	}

	async run() {
		const { flags } = await this.parseFlags();
		const packageName = flags.package;

		if (!packageName) {
			this.logger.info('"--package" has to be set!');
			return;
		}

		if (!flags.uninstall) {
			this.logger.info('"--uninstall" has to be set!');
			return;
		}

		const communityPackage = await this.findCommunityPackage(packageName);

		if (communityPackage === null) {
			this.logger.info(`Package ${packageName} not found`);
			return;
		}

		await this.deleteCommunityPackage(packageName);

		const installedNodes = communityPackage?.installedNodes;

		if (!installedNodes) {
			this.logger.info(`Nodes in ${packageName} not found`);
			return;
		}

		for (const node of installedNodes) {
			await this.deleteCommunityNode(node);
		}

		this.logger.info(`${packageName} successfully uninstalled`);
	}

	async catch(error: Error) {
		this.logger.error('Error in node command:');
		this.logger.error(error.message);
	}

	async parseFlags() {
		return await this.parse(CommunityNode);
	}

	async deleteCommunityNode(node: InstalledNodes) {
		return await Container.get(InstalledNodesRepository).delete({
			type: node.type,
		});
	}

	async deleteCommunityPackage(packageName: string) {
		return await Container.get(InstalledPackagesRepository).delete({
			packageName,
		});
	}

	async findCommunityPackage(packageName: string) {
		return await Container.get(InstalledPackagesRepository).findOne({
			where: { packageName },
			relations: ['installedNodes'],
		});
	}
}
