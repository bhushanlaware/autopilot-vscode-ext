import * as React from "react";
import { CheckIcon, CopyIcon, IconButton } from './icons';

export default function CodeCopyBtn({ children }: any) {
	const [copyOk, setCopyOk] = React.useState(false);
	const Icon = copyOk ? CheckIcon : CopyIcon;

	const handleClick = () => {
		navigator.clipboard.writeText(children[0].props.children[0]);
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
