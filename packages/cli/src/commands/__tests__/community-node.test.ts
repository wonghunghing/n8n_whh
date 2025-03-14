import { type Config } from '@oclif/core';
import { mock } from 'jest-mock-extended';

import { type InstalledNodes } from '@/databases/entities/installed-nodes';

import { CommunityNode } from '../community-node';

describe('run', () => {
	const config: Config = mock<Config>();
	const node = new CommunityNode(
		['--uninstall', '--package', 'n8n-nodes-evolution-api.evolutionApi'],
		config,
	);

	beforeEach(() => {
		node.deleteCommunityPackage = jest.fn();
		node.deleteCommunityNode = jest.fn();
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it('should uninstall the package', async () => {
		const installedNode = mock<InstalledNodes>();

		node.parseFlags = jest.fn().mockReturnValue({
			flags: { package: 'n8n-nodes-evolution-api', uninstall: true },
		});
		node.findCommunityPackage = jest.fn().mockReturnValue({
			installedNodes: [installedNode],
		});

		const deleteCommunityNode = jest.spyOn(node, 'deleteCommunityNode');
		const deleteCommunityPackageSpy = jest.spyOn(node, 'deleteCommunityPackage');
		const findCommunityPackage = jest.spyOn(node, 'findCommunityPackage');

		await node.run();

		expect(findCommunityPackage).toHaveBeenCalledTimes(1);
		expect(findCommunityPackage).toHaveBeenCalledWith('n8n-nodes-evolution-api');

		expect(deleteCommunityNode).toHaveBeenCalledTimes(1);
		expect(deleteCommunityNode).toHaveBeenCalledWith(installedNode);

		expect(deleteCommunityPackageSpy).toHaveBeenCalledTimes(1);
		expect(deleteCommunityPackageSpy).toHaveBeenCalledWith('n8n-nodes-evolution-api');
	});

	it('should uninstall all nodes from a package', async () => {
		const installedNode0 = mock<InstalledNodes>();
		const installedNode1 = mock<InstalledNodes>();

		node.parseFlags = jest.fn().mockReturnValue({
			flags: { package: 'n8n-nodes-evolution-api', uninstall: true },
		});
		node.findCommunityPackage = jest.fn().mockReturnValue({
			installedNodes: [installedNode0, installedNode1],
		});

		const deleteCommunityNode = jest.spyOn(node, 'deleteCommunityNode');
		const deleteCommunityPackageSpy = jest.spyOn(node, 'deleteCommunityPackage');
		const findCommunityPackage = jest.spyOn(node, 'findCommunityPackage');

		await node.run();

		expect(findCommunityPackage).toHaveBeenCalledTimes(1);
		expect(findCommunityPackage).toHaveBeenCalledWith('n8n-nodes-evolution-api');

		expect(deleteCommunityNode).toHaveBeenCalledTimes(2);
		expect(deleteCommunityNode).toHaveBeenCalledWith(installedNode0);
		expect(deleteCommunityNode).toHaveBeenCalledWith(installedNode1);

		expect(deleteCommunityPackageSpy).toHaveBeenCalledTimes(1);
		expect(deleteCommunityPackageSpy).toHaveBeenCalledWith('n8n-nodes-evolution-api');
	});

	it('should return if a package is not found', async () => {
		node.parseFlags = jest.fn().mockReturnValue({
			flags: { package: 'n8n-nodes-evolution-api', uninstall: true },
		});
		node.findCommunityPackage = jest.fn().mockReturnValue(null);

		const deleteCommunityNode = jest.spyOn(node, 'deleteCommunityNode');
		const deleteCommunityPackageSpy = jest.spyOn(node, 'deleteCommunityPackage');
		const findCommunityPackage = jest.spyOn(node, 'findCommunityPackage');

		await node.run();

		expect(findCommunityPackage).toHaveBeenCalledTimes(1);
		expect(findCommunityPackage).toHaveBeenCalledWith('n8n-nodes-evolution-api');

		expect(deleteCommunityNode).toHaveBeenCalledTimes(0);

		expect(deleteCommunityPackageSpy).toHaveBeenCalledTimes(0);
	});

	it('should return if nodes are not found', async () => {
		node.parseFlags = jest.fn().mockReturnValue({
			flags: { package: 'n8n-nodes-evolution-api', uninstall: true },
		});
		node.findCommunityPackage = jest.fn().mockReturnValue({
			installedNodes: [],
		});

		const deleteCommunityNode = jest.spyOn(node, 'deleteCommunityNode');
		const deleteCommunityPackageSpy = jest.spyOn(node, 'deleteCommunityPackage');
		const findCommunityPackage = jest.spyOn(node, 'findCommunityPackage');

		await node.run();

		expect(findCommunityPackage).toHaveBeenCalledTimes(1);
		expect(findCommunityPackage).toHaveBeenCalledWith('n8n-nodes-evolution-api');

		expect(deleteCommunityNode).toHaveBeenCalledTimes(0);

		expect(deleteCommunityPackageSpy).toHaveBeenCalledTimes(1);
		expect(deleteCommunityPackageSpy).toHaveBeenCalledWith('n8n-nodes-evolution-api');
	});
});
