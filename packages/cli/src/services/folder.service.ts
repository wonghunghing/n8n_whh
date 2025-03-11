import type { CreateFolderDto, DeleteFolderDto, UpdateFolderDto } from '@n8n/api-types';
import { Service } from '@n8n/di';
// eslint-disable-next-line n8n-local-rules/misplaced-n8n-typeorm-import
import type { EntityManager } from '@n8n/typeorm';
import { UserError } from 'n8n-workflow';
import { PROJECT_ROOT } from 'n8n-workflow/src/Constants';

import { Folder } from '@/databases/entities/folder';
import { FolderTagMappingRepository } from '@/databases/repositories/folder-tag-mapping.repository';
import { FolderRepository } from '@/databases/repositories/folder.repository';
import { WorkflowRepository } from '@/databases/repositories/workflow.repository';
import { FolderNotFoundError } from '@/errors/folder-not-found.error';
import type { ListQuery } from '@/requests';

export interface SimpleFolderNode {
	id: string;
	name: string;
	children: SimpleFolderNode[];
}

interface FolderPathRow {
	folder_id: string;
	folder_name: string;
	folder_parent_folder_id: string | null;
}

@Service()
export class FolderService {
	constructor(
		private readonly folderRepository: FolderRepository,
		private readonly folderTagMappingRepository: FolderTagMappingRepository,
		private readonly workflowRepository: WorkflowRepository,
	) {}

	async createFolder({ parentFolderId, name }: CreateFolderDto, projectId: string) {
		let parentFolder = null;
		if (parentFolderId) {
			parentFolder = await this.findFolderInProjectOrFail(parentFolderId, projectId);
		}

		const folderEntity = this.folderRepository.create({
			name,
			homeProject: { id: projectId },
			parentFolder,
		});

		const { homeProject, ...folder } = await this.folderRepository.save(folderEntity);

		return folder;
	}

	async updateFolder(
		folderId: string,
		projectId: string,
		{ name, tagIds, parentFolderId }: UpdateFolderDto,
	) {
		await this.findFolderInProjectOrFail(folderId, projectId);
		if (name) {
			await this.folderRepository.update({ id: folderId }, { name });
		}
		if (tagIds) {
			await this.folderTagMappingRepository.overwriteTags(folderId, tagIds);
		}

		if (parentFolderId) {
			if (folderId === parentFolderId) {
				throw new UserError('Cannot set a folder as its own parent');
			}

			if (parentFolderId !== PROJECT_ROOT) {
				await this.findFolderInProjectOrFail(parentFolderId, projectId);
			}
			await this.folderRepository.update(
				{ id: folderId },
				{ parentFolder: parentFolderId !== PROJECT_ROOT ? { id: parentFolderId } : null },
			);
		}
	}

	async findFolderInProjectOrFail(folderId: string, projectId: string, em?: EntityManager) {
		try {
			return await this.folderRepository.findOneOrFailFolderInProject(folderId, projectId, em);
		} catch {
			throw new FolderNotFoundError(folderId);
		}
	}

	async getFolderTree(folderId: string, projectId: string): Promise<SimpleFolderNode[]> {
		await this.findFolderInProjectOrFail(folderId, projectId);

		const escapedParentFolderId = this.folderRepository
			.createQueryBuilder()
			.escape('parentFolderId');

		const baseQuery = this.folderRepository
			.createQueryBuilder('folder')
			.select('folder.id', 'id')
			.addSelect('folder.parentFolderId', 'parentFolderId')
			.where('folder.id = :folderId', { folderId });

		const recursiveQuery = this.folderRepository
			.createQueryBuilder('f')
			.select('f.id', 'id')
			.addSelect('f.parentFolderId', 'parentFolderId')
			.innerJoin('folder_path', 'fp', `f.id = fp.${escapedParentFolderId}`);

		const mainQuery = this.folderRepository
			.createQueryBuilder('folder')
			.select('folder.id', 'folder_id')
			.addSelect('folder.name', 'folder_name')
			.addSelect('folder.parentFolderId', 'folder_parent_folder_id')
			.addCommonTableExpression(
				`${baseQuery.getQuery()} UNION ALL ${recursiveQuery.getQuery()}`,
				'folder_path',
				{ recursive: true },
			)
			.where((qb) => {
				const subQuery = qb.subQuery().select('fp.id').from('folder_path', 'fp').getQuery();
				return `folder.id IN ${subQuery}`;
			})
			.setParameters({
				folderId,
			});

		const result = await mainQuery.getRawMany<FolderPathRow>();

		return this.transformFolderPathToTree(result);
	}

	async deleteFolder(folderId: string, projectId: string, { transferToFolderId }: DeleteFolderDto) {
		await this.findFolderInProjectOrFail(folderId, projectId);

		if (!transferToFolderId) {
			await this.folderRepository.delete({ id: folderId });
			return;
		}

		if (folderId === transferToFolderId) {
			throw new UserError('Cannot transfer folder contents to the folder being deleted');
		}

		await this.findFolderInProjectOrFail(transferToFolderId, projectId);

		return await this.folderRepository.manager.transaction(async (tx) => {
			await this.folderRepository.moveAllToFolder(folderId, transferToFolderId, tx);
			await this.workflowRepository.moveAllToFolder(folderId, transferToFolderId, tx);
			await tx.delete(Folder, { id: folderId });
			return;
		});
	}

	async transferAllFoldersToProject(
		fromProjectId: string,
		toProjectId: string,
		tx?: EntityManager,
	) {
		return await this.folderRepository.transferAllFoldersToProject(fromProjectId, toProjectId, tx);
	}

	private transformFolderPathToTree(flatPath: FolderPathRow[]): SimpleFolderNode[] {
		if (!flatPath || flatPath.length === 0) {
			return [];
		}

		const folderMap = new Map<string, SimpleFolderNode>();

		// First pass: create all nodes
		flatPath.forEach((folder) => {
			folderMap.set(folder.folder_id, {
				id: folder.folder_id,
				name: folder.folder_name,
				children: [],
			});
		});

		let rootNode: SimpleFolderNode | null = null;

		// Second pass: build the tree
		flatPath.forEach((folder) => {
			const currentNode = folderMap.get(folder.folder_id)!;

			if (folder.folder_parent_folder_id && folderMap.has(folder.folder_parent_folder_id)) {
				const parentNode = folderMap.get(folder.folder_parent_folder_id)!;
				parentNode.children = [currentNode];
			} else {
				rootNode = currentNode;
			}
		});

		return rootNode ? [rootNode] : [];
	}

	async getManyAndCount(projectId: string, options: ListQuery.Options) {
		options.filter = { ...options.filter, projectId };
		return await this.folderRepository.getManyAndCount(options);
	}
}
