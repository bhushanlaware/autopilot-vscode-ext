import * as React from 'react';
import * as ReactDOM from 'react-dom';
import './index.css';
import '../common/App.css';

//@ts-ignore
const vscode = acquireVsCodeApi();

function SearchApp() {
	React.useEffect(() => {
		vscode.postMessage({ type: 'onMountSearch' });
	}, []);

	return (
		<div className="gcse-search"></div>
	);
}

ReactDOM.render(<SearchApp />, document.getElementById('root'));
