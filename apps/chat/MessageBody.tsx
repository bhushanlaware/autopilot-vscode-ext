import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark as darkCodeTheme, oneLight as lightCodeTheme } from "react-syntax-highlighter/dist/cjs/styles/prism";

import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import CodeCopyBtn from "./CodeCopyBtn";
import themeContext from "./hook/useTheme";

export default function MessageBody({ content, onCopy }: any) {
  // Add the CodeCopyBtn component to our PRE element
  const Pre = ({ children }: any) => (
    <pre className="message-pre">
      <CodeCopyBtn onCopy={onCopy}>{children}</CodeCopyBtn>
      {children}
    </pre>
  );
  const theme = React.useContext(themeContext);

  return (
    <ReactMarkdown
      className="post-markdown"
      linkTarget="_blank"
      rehypePlugins={[rehypeRaw]}
      remarkPlugins={[remarkGfm]}
      components={{
        pre: Pre,
        code({ node, inline, className = "blog-code", children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "plaintext";
          return !inline ? (
            <SyntaxHighlighter
              // @ts-ignore
              style={theme === "dark" ? darkCodeTheme : lightCodeTheme}
              language={language}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
