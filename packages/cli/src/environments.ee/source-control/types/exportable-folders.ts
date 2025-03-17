export type ExportableFolder = {
	id: string;
	name: string;
	parentFolderId: string | null;
	homeProjectId: string;
};

export type WorkflowFolderMapping = {
	parentFolderId: string;
	workflowId: string;
};
