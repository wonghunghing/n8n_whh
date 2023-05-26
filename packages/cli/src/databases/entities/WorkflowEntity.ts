import { Length } from 'class-validator';

import { IConnections, IDataObject, IWorkflowSettings } from 'n8n-workflow';
import type { IBinaryKeyData, INode, IPairedItemData } from 'n8n-workflow';

import {
	Column,
	Entity,
	Generated,
	Index,
	JoinColumn,
	JoinTable,
	ManyToMany,
	OneToMany,
	PrimaryColumn,
	Relation,
} from 'typeorm';

import config from '@/config';
import type { TagEntity } from './TagEntity';
import type { SharedWorkflow } from './SharedWorkflow';
import type { WorkflowStatistics } from './WorkflowStatistics';
import type { WorkflowTagMapping } from './WorkflowTagMapping';
import { idStringifier, objectRetriever, sqlite } from '../utils/transformers';
import { AbstractEntity, jsonColumnType } from './AbstractEntity';
import type { IWorkflowDb } from '@/Interfaces';

@Entity()
export class WorkflowEntity extends AbstractEntity implements IWorkflowDb {
	@Generated()
	@PrimaryColumn({ transformer: idStringifier })
	id: string;

	// TODO: Add XSS check
	@Index({ unique: true })
	@Length(1, 128, {
		message: 'Workflow name must be $constraint1 to $constraint2 characters long.',
	})
	@Column({ length: 128 })
	name: string;

	@Column()
	active: boolean;

	@Column(jsonColumnType)
	nodes: INode[];

	@Column(jsonColumnType)
	connections: IConnections;

	@Column({
		type: jsonColumnType,
		nullable: true,
	})
	settings?: IWorkflowSettings;

	@Column({
		type: jsonColumnType,
		nullable: true,
		transformer: objectRetriever,
	})
	staticData?: IDataObject;

	@ManyToMany('TagEntity', 'workflows')
	@JoinTable({
		name: 'workflows_tags', // table name for the junction table of this relation
		joinColumn: {
			name: 'workflowId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'tagId',
			referencedColumnName: 'id',
		},
	})
	tags?: Relation<TagEntity[]>;

	@OneToMany('WorkflowTagMapping', 'workflows')
	tagMappings: Relation<WorkflowTagMapping[]>;

	@OneToMany('SharedWorkflow', 'workflow')
	shared: Relation<SharedWorkflow[]>;

	@OneToMany('WorkflowStatistics', 'workflow')
	@JoinColumn({ referencedColumnName: 'workflow' })
	statistics: Relation<WorkflowStatistics[]>;

	@Column({
		type: config.getEnv('database.type') === 'sqlite' ? 'text' : 'json',
		nullable: true,
		transformer: sqlite.jsonColumn,
	})
	pinData: ISimplifiedPinData;

	@Column({ length: 36 })
	versionId: string;

	@Column({ default: 0 })
	triggerCount: number;
}

/**
 * Simplified to prevent excessively deep type instantiation error from
 * `INodeExecutionData` in `IPinData` in a TypeORM entity field.
 */
export interface ISimplifiedPinData {
	[nodeName: string]: Array<{
		json: IDataObject;
		binary?: IBinaryKeyData;
		pairedItem?: IPairedItemData | IPairedItemData[] | number;
	}>;
}
