import * as React from "react";
import { CheckIcon, CopyIcon, IconButton } from './icons';

export default function CodeCopyBtn({ children, onCopy }: any) {
	const [copyOk, setCopyOk] = React.useState(false);
	const Icon = copyOk ? CheckIcon : CopyIcon;

	const handleClick = () => {
		const code = children[0].props.children[0];
		navigator.clipboard.writeText(children[0].props.children[0]);
		onCopy(code);
		setCopyOk(true);
		setTimeout(() => {
			setCopyOk(false);
		}, 500);
	}

	return (
		<div className="code-copy-btn">
			<IconButton onClick={handleClick}>
				<Icon />
			</IconButton>
		</div>
	);
}
