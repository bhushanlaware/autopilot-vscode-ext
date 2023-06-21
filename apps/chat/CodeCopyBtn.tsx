import * as React from "react";
// import { CheckIcon, CopyIcon, IconButton } from "./icons";
import themeContext from "./hook/useTheme";
import { FaCheck, FaRegCopy } from 'react-icons/fa';

const GreenCheckIcon = () => {
  const theme = React.useContext(themeContext);
  const isLight = theme === 'light';
  return <FaCheck style={{ color: isLight ? "#008e00" : "#00ff00" }} />;
};

export default function CodeCopyBtn({ children, onCopy }: any) {
  const [copyOk, setCopyOk] = React.useState(false);


  const Icon = copyOk ? GreenCheckIcon : FaRegCopy;

  const handleClick = () => {
    const code = children[0].props.children[0];
    navigator.clipboard.writeText(children[0].props.children[0]);
    onCopy(code);
    setCopyOk(true);
    setTimeout(() => {
      setCopyOk(false);
    }, 500);
  };

  return (
    <div className="code-copy-btn" onClick={handleClick} role="button">
      <Icon />
    </div>
  );
}
