import React from 'react';
import {withStyles, createStyles, Theme} from '@material-ui/core/styles';
import classnames from 'classnames';
import Editor from 'react-simple-code-editor';
import escape from 'escape-html';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import { prefTypes, withThemeName } from '../../features/preferences';
import { light, dark } from './themes/simple-editor';

type Props = {
  classes: any;
  path: string;
  value: string;
  onValueChange: (value: string) => void;
  lineNumbers: 'on' | 'off';
  theme: prefTypes.ThemeName;
};

// Store selection and undo stack
const sessions = new Map();

class SimpleEditor extends React.Component<Props> {
  static defaultProps: Partial<Props> = {
    lineNumbers: 'on',
  };

  static removePath(path: string) {
    sessions.delete(path);
  }

  static renamePath(oldPath: string, newPath: string) {
    const session = sessions.get(oldPath);

    sessions.delete(oldPath);
    sessions.set(newPath, session);
  }

  componentDidUpdate(prevProps: Props) {
    const editor = this._editor.current;

    if (this.props.path !== prevProps.path && editor) {
      // Save the editor state for the previous file so we can restore it when it's re-opened
      sessions.set(prevProps.path, editor.session);

      // If we find a previous session for the current file, restore it
      // Otherwise set the session session to a fresh one
      const session = sessions.get(this.props.path);

      if (session) {
        editor.session = session;
      } else {
        editor.session = {
          history: {
            stack: [],
            offset: -1,
          },
        };
      }
    }
  }

  _highlight = (code: string) => {
    if (this.props.path.endsWith('.ts') || this.props.path.endsWith('.tsx')) {
      return highlight(code, languages.ts);
    } else if (this.props.path.endsWith('.js')) {
      return highlight(code, languages.jsx);
    } else if (this.props.path.endsWith('.json')) {
      return highlight(code, languages.json);
    } else if (this.props.path.endsWith('.md')) {
      return highlight(code, languages.markdown);
    }

    return escape(code);
  };

  _editor = React.createRef<Editor>();

  render() {
    const { classes, value, lineNumbers, theme, onValueChange } = this.props;

    return (
      <div
        className={classnames(classes.container, lineNumbers === 'on' && classes.containerWithLineNumbers)}>
        <Editor
          // @ts-ignore
          ref={this._editor}
          value={value}
          onValueChange={onValueChange}
          highlight={(code: string) =>
            lineNumbers === 'on'
              ? this._highlight(code)
                  .split('\n')
                  .map((line: string) => `<span class="${classes.line}">${line}</span>`)
                  .join('\n')
              : this._highlight(code)
          }
          padding={lineNumbers === 'on' ? 0 : 8}
          className={classnames(classes.editor, 'prism-code')}
        />
        <style
          type="text/css"
          dangerouslySetInnerHTML={{ __html: theme === 'dark' ? dark : light }}
        />
      </div>
    );
  }
}

const muiStyles =  (theme: Theme) => createStyles({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
    overflow: 'auto',
  },
  containerWithLineNumbers: {
    paddingLeft: 64,
  },
  editor: {
    fontFamily: 'var(--font-monospace)',
    fontSize: 12,
    minHeight: '100%',
    counterReset: 'line',
  },
  line: {
    '&:before': {
      position: 'absolute',
      right: '100%',
      marginRight: 26,
      textAlign: 'right',
      opacity: 0.5,
      userSelect: 'none',
      counterIncrement: 'line',
      content: 'counter(line)',
    },
  },
});
export default withStyles(muiStyles)(withThemeName(SimpleEditor));