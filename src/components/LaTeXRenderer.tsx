import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

interface LaTeXRendererProps {
    content: string;
}

const LaTeXRenderer: React.FC<LaTeXRendererProps> = ({ content }) => {
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body);"></script>
        <style>
          body {
            font-family: -apple-system, system-ui;
            font-size: 16px;
            color: #1E293B;
            margin: 0;
            padding: 0;
            line-height: 1.5;
            background-color: transparent;
          }
          .content-wrapper {
            word-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <div class="content-wrapper">
          ${content.replace(/\n/g, '<br/>')}
        </div>
        <script>
          window.onload = function() {
            // Wait for KaTeX to finish rendering
            setTimeout(function() {
              window.ReactNativeWebView.postMessage(document.body.scrollHeight);
            }, 500);
          }
        </script>
      </body>
    </html>
  `;

    const [height, setHeight] = React.useState(100);

    return (
        <View style={{ height: height }}>
            <WebView
                originWhitelist={['*']}
                source={{ html: htmlContent }}
                onMessage={(event) => {
                    const contentHeight = parseInt(event.nativeEvent.data);
                    if (contentHeight > 0) {
                        setHeight(contentHeight + 20);
                    }
                }}
                scrollEnabled={false}
                style={{ backgroundColor: 'transparent' }}
            />
        </View>
    );
};

export default LaTeXRenderer;
