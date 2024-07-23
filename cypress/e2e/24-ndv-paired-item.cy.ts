import { WorkflowPage, NDV } from '../pages';

const workflowPage = new WorkflowPage();
const ndv = new NDV();

describe('NDV', () => {
	beforeEach(() => {
		workflowPage.actions.visit();
		workflowPage.actions.renameWithUniqueName();
		workflowPage.actions.saveWorkflowOnButtonClick();
	});

	it('maps paired input and output items', () => {
		cy.fixture('Test_workflow_5.json').then((data) => {
			cy.get('body').paste(JSON.stringify(data));
		});
		workflowPage.actions.zoomToFit();

		workflowPage.actions.executeWorkflow();

		workflowPage.actions.openNode('Sort');

		ndv.getters.inputPanel().contains('6 items').should('exist');
		ndv.getters.outputPanel().contains('6 items').should('exist');

		ndv.actions.switchInputMode('Table');
		ndv.actions.switchOutputMode('Table');

		// input to output
		ndv.getters.inputTableRow(1).should('exist');

		ndv.getters.inputTableRow(1).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.getters.inputTableRow(1).realHover();
		ndv.getters.outputTableRow(4).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.getters.inputTableRow(2).realHover();
		ndv.getters.outputTableRow(2).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.getters.inputTableRow(3).realHover();
		ndv.getters.outputTableRow(6).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		// output to input
		ndv.getters.outputTableRow(1).realHover();
		ndv.getters.inputTableRow(4).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.getters.outputTableRow(4).realHover();
		ndv.getters.inputTableRow(1).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.getters.outputTableRow(2).realHover();
		ndv.getters.inputTableRow(2).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.getters.outputTableRow(6).realHover();
		ndv.getters.inputTableRow(3).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.getters.outputTableRow(1).realHover();
		ndv.getters.inputTableRow(4).invoke('attr', 'data-test-id').should('equal', 'hovering-item');
	});

	it('maps paired input and output items based on selected input node', () => {
		cy.fixture('Test_workflow_5.json').then((data) => {
			cy.get('body').paste(JSON.stringify(data));
		});
		workflowPage.actions.zoomToFit();
		workflowPage.actions.executeWorkflow();
		workflowPage.actions.openNode('Set2');

		ndv.getters.inputPanel().contains('6 items').should('exist');
		ndv.getters
			.outputRunSelector()
			.find('input')
			.should('exist')
			.should('have.value', '2 of 2 (6 items)');

		ndv.actions.switchInputMode('Table');
		ndv.actions.switchOutputMode('Table');

		ndv.getters.backToCanvas().realHover(); // reset to default hover
		ndv.getters.outputHoveringItem().should('not.exist');
		ndv.getters.parameterExpressionPreview('value').should('include.text', '1111');

		ndv.actions.selectInputNode('Set1');
		ndv.getters.backToCanvas().realHover(); // reset to default hover

		ndv.getters.inputTableRow(1).should('have.text', '1000');

		ndv.getters.inputTableRow(1).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.getters.inputTableRow(1).realHover();
		cy.wait(50);
		ndv.getters.outputHoveringItem().should('have.text', '1000');
		ndv.getters.parameterExpressionPreview('value').should('include.text', '1000');

		ndv.actions.selectInputNode('Sort');
		ndv.actions.changeOutputRunSelector('1 of 2 (6 items)');
		ndv.getters.backToCanvas().realHover(); // reset to default hover

		ndv.getters.inputTableRow(1).should('have.text', '1111');

		ndv.getters.inputTableRow(1).invoke('attr', 'data-test-id').should('equal', 'hovering-item');
		ndv.getters.inputTableRow(1).realHover();
		cy.wait(50);
		ndv.getters.outputHoveringItem().should('have.text', '1111');
		ndv.getters.parameterExpressionPreview('value').should('include.text', '1111');
	});

	it('maps paired input and output items based on selected run', () => {
		cy.fixture('Test_workflow_5.json').then((data) => {
			cy.get('body').paste(JSON.stringify(data));
		});
		workflowPage.actions.zoomToFit();
		workflowPage.actions.executeWorkflow();
		workflowPage.actions.openNode('Set3');

		ndv.actions.switchInputMode('Table');
		ndv.actions.switchOutputMode('Table');

		ndv.getters
			.inputRunSelector()
			.should('exist')
			.find('input')
			.should('include.value', '2 of 2 (6 items)');
		ndv.getters
			.outputRunSelector()
			.should('exist')
			.find('input')
			.should('include.value', '2 of 2 (6 items)');

		ndv.actions.changeOutputRunSelector('1 of 2 (6 items)');
		ndv.getters.inputRunSelector().find('input').should('include.value', '1 of 2 (6 items)');
		ndv.getters.outputRunSelector().find('input').should('include.value', '1 of 2 (6 items)');

		ndv.getters.inputTableRow(1).should('have.text', '1111');
		ndv.getters.inputTableRow(1).invoke('attr', 'data-test-id').should('equal', 'hovering-item');
		ndv.getters.outputTableRow(1).should('have.text', '1111');
		ndv.getters.outputTableRow(1).realHover();

		ndv.getters.outputTableRow(3).should('have.text', '4444');
		ndv.getters.outputTableRow(3).realHover();

		ndv.getters.inputTableRow(3).should('have.text', '4444');
		ndv.getters.inputTableRow(3).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.actions.changeOutputRunSelector('2 of 2 (6 items)');
		cy.wait(50);

		ndv.getters.inputTableRow(1).should('have.text', '1000');
		ndv.getters.inputTableRow(1).realHover();

		ndv.getters.outputTableRow(1).should('have.text', '1000');
		ndv.getters
			.outputTableRow(1)
			.should('have.text', '1000')
			.invoke('attr', 'data-test-id')
			.should('equal', 'hovering-item');

		ndv.getters.outputTableRow(3).should('have.text', '2000');
		ndv.getters.outputTableRow(3).realHover();

		ndv.getters.inputTableRow(3).should('have.text', '2000');

		ndv.getters.inputTableRow(3).invoke('attr', 'data-test-id').should('equal', 'hovering-item');
	});

	it('can pair items between input and output across branches and runs', () => {
		cy.fixture('Test_workflow_5.json').then((data) => {
			cy.get('body').paste(JSON.stringify(data));
		});
		workflowPage.actions.zoomToFit();
		workflowPage.actions.executeWorkflow();
		workflowPage.actions.openNode('IF');

		ndv.actions.switchInputMode('Table');
		ndv.actions.switchOutputMode('Table');

		ndv.actions.switchOutputBranch('False Branch (2 items)');
		ndv.getters.outputTableRow(1).should('have.text', '8888');
		ndv.getters.outputTableRow(1).realHover();

		ndv.getters.inputTableRow(5).should('have.text', '8888');

		ndv.getters.inputTableRow(5).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.getters.outputTableRow(2).should('have.text', '9999');
		ndv.getters.outputTableRow(2).realHover();

		ndv.getters.inputTableRow(6).should('have.text', '9999');

		ndv.getters.inputTableRow(6).invoke('attr', 'data-test-id').should('equal', 'hovering-item');

		ndv.actions.close();

		workflowPage.actions.openNode('Set5');

		ndv.actions.switchInputBranch('True Branch');
		ndv.actions.changeOutputRunSelector('1 of 2 (2 items)');
		ndv.getters.outputTableRow(1).should('have.text', '8888');
		ndv.getters.outputTableRow(1).realHover();
		cy.wait(100);
		ndv.getters.inputHoveringItem().should('not.exist');

		ndv.getters.inputTableRow(1).should('have.text', '1111');
		ndv.getters.inputTableRow(1).realHover();
		cy.wait(100);
		ndv.getters.outputHoveringItem().should('not.exist');

		ndv.actions.switchInputBranch('False Branch');
		ndv.getters.inputTableRow(1).should('have.text', '8888');
		ndv.getters.inputTableRow(1).realHover();

		ndv.actions.changeOutputRunSelector('2 of 2 (4 items)');
		ndv.getters.outputTableRow(1).should('have.text', '1111');
		ndv.getters.outputTableRow(1).realHover();

		ndv.actions.changeOutputRunSelector('1 of 2 (2 items)');
		ndv.getters.inputTableRow(1).should('have.text', '8888');
		ndv.getters.inputTableRow(1).realHover();
		ndv.getters.outputHoveringItem().should('have.text', '8888');
		// todo there's a bug here need to fix ADO-534
		// ndv.getters.outputHoveringItem().should('not.exist');
	});

	it('can resolve expression with paired item in multi-input node', () => {
		cy.fixture('expression_with_paired_item_in_multi_input_node.json').then((data) => {
			cy.get('body').paste(JSON.stringify(data));
		});

		workflowPage.actions.zoomToFit();

		/* prettier-ignore */
		const PINNED_DATA = [
			{
				"id": "abc",
				"historyId": "def",
				"messages": [
					{
						"id": "abc"
					}
				]
			},
			{
				"id": "abc",
				"historyId": "def",
				"messages": [
					{
						"id": "abc"
					},
					{
						"id": "abc"
					},
					{
						"id": "abc"
					}
				]
			},
			{
				"id": "abc",
				"historyId": "def",
				"messages": [
					{
						"id": "abc"
					}
				]
			}
		];
		/* prettier-ignore */
		workflowPage.actions.openNode('Get thread details1');
		ndv.actions.pastePinnedData(PINNED_DATA);
		ndv.actions.close();

		workflowPage.actions.executeWorkflow();
		workflowPage.actions.openNode('Switch1');
		ndv.actions.execute();

		ndv.getters.parameterExpressionPreview('output').should('include.text', '1');
	});
});
