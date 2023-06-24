import * as React from 'react';
import * as ReactDOM from 'react-dom';
import './index.css';
import '../common/App.css';
import { IUsage } from '../../src/types';

//@ts-ignore
const vscode = acquireVsCodeApi();

function UsageApp() {
	const [usage, setUsage] = React.useState<IUsage | null>(null);

	React.useEffect(() => {
		vscode.postMessage({ type: 'onMountUsage' });
	}, []);

	React.useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data;
			switch (message.type) {
				case "updateUsage":
					setUsage(message.usage);
					break;
				default:
					break;
			}
		};
		window.addEventListener("message", handler);

		return () => window.removeEventListener("message", handler);
	}, []);

	if (!usage) {
		return null;
	}

	const totalToken = usage.chat.totalTokenUsed + usage.completion.totalTokenUsed + usage.embedding.totalTokenUsed;
	const totalCost = usage.chat.totalCost + usage.completion.totalCost + usage.embedding.totalCost;

	return (
		<div>
			<table className='vscode-table'>
				<thead>
					<tr>
						<td>Service</td>
						<td>Token Used</td>
						<td>Total $</td>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Chat</td>
						<td>{usage.chat.totalTokenUsed / 1000}k</td>
						<td>{Number(usage.chat.totalCost).toFixed(4)}$</td>
					</tr>
					<tr>
						<td>Completion</td>
						<td>{usage.completion.totalTokenUsed / 1000}k</td>
						<td>{Number(usage.completion.totalCost).toFixed(4)}$</td>
					</tr>
					<tr>
						<td>Embedding</td>
						<td>{usage.embedding.totalTokenUsed / 1000}k</td>
						<td>{Number(usage.embedding.totalCost).toFixed(4)}$</td>
					</tr>
					<tr>
						<td>Total</td>
						<td>{totalToken / 1000}k</td>
						<td>{Number(totalCost).toFixed(4)}$</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}

ReactDOM.render(<UsageApp />, document.getElementById('root'));
