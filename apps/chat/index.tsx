import * as React from 'react';
import * as ReactDOM from 'react-dom';
import MessageBody from './MessageBody';

import '../common/App.css';
import './index.css';
import { ClearIcon } from './icons';

type GPTMessage = {
	role: 'user' | 'assistant';
	content: string;
};

//@ts-ignore
const vscode = acquireVsCodeApi();

function ChatApp() {
	const [input, setInput] = React.useState<string>('');
	const [history, setHistory] = React.useState<Array<GPTMessage>>([]);
	const [prePartialAnswer, setPrevPartialAnswer] = React.useState<string>('');

	React.useEffect(() => {
		vscode.postMessage({ type: 'onMountChat' });
	}, []);

	React.useEffect(() => {
		const chatList = document.querySelector('.chat_list');
		if (chatList) {
			chatList.scrollTop = chatList.scrollHeight;
		}
	}, [history, prePartialAnswer]);

	React.useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data;
			switch (message.type) {

				case 'partial_answer_done':
					setHistory([...history, { role: 'assistant', content: prePartialAnswer }]);
					setPrevPartialAnswer('');
					break;

				case 'partial_answer':
					setPrevPartialAnswer(`${prePartialAnswer}${message.partialAnswer}`);
					break;

				case 'set_history':
					setHistory(message.history);
					break;
				default:
					break;
			}
		};
		window.addEventListener('message', handler);

		return () => window.removeEventListener('message', handler);
	}, [prePartialAnswer]);

	function handleClick() {
		if (!input.length) {
			return;
		}
		console.log('sending message', input);
		vscode.postMessage({ type: 'ask_question', question: input });

		setHistory([...history, { role: 'user', content: input }]);
		setInput('');
	}

	function clearChat() {
		setHistory([]);
		vscode.postMessage({ type: 'clear_chat' });
	}

	function handleCancel() {
		vscode.postMessage({ type: 'cancel_question' });
		setHistory([...history, { role: 'assistant', content: prePartialAnswer }]);
		setPrevPartialAnswer('');
	}

	function handleEnter(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter') {
			handleClick();
		}
	}

	return (
		<div className="chat_body">

			<div className="chat_list">
				{history.map((message, index) => (
					<Chat key={index} message={message} />
				))}
				{prePartialAnswer && <Chat message={{ role: 'assistant', content: prePartialAnswer }} />}
			</div>
			<div className="chat-controller">

				<input
					placeholder="Ask question.."
					value={input}
					onKeyDown={handleEnter}
					onChange={(e) => { setInput(e.target.value); }}
				></input>
				{prePartialAnswer ?
					<button className='danger mr-2' onClick={handleCancel}>Stop</button> :
					<button className='primary mr-2' onClick={handleClick}>Send</button>
				}
				{
					history.length ?
						<button className='warning' onClick={clearChat}><ClearIcon /></button>
						: null
				}
			</div>
		</div>
	);
}


type ChatProps = {
	message: GPTMessage;
};

function Chat({ message }: ChatProps) {
	return (
		<div className="chat">
			<div className="message">
				<div className="message__author">{message.role}</div>
				<div className="message__text">
					<MessageBody content={message.content} />
				</div>
			</div>
		</div>
	);
}

ReactDOM.render(<ChatApp />, document.getElementById('root'));
