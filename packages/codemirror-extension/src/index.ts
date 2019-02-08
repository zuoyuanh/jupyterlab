// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import CodeMirror from 'codemirror';

import { Menu } from '@phosphor/widgets';

import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IMainMenu, IEditMenu } from '@jupyterlab/mainmenu';

import { IEditorServices } from '@jupyterlab/codeeditor';

import {
  editorServices,
  EditorSyntaxStatus,
  CodeMirrorEditor,
  Mode
} from '@jupyterlab/codemirror';

import { ISettingRegistry } from '@jupyterlab/coreutils';

import { IDocumentWidget } from '@jupyterlab/docregistry';

import { IEditorTracker, FileEditor } from '@jupyterlab/fileeditor';

import { IStatusBar } from '@jupyterlab/statusbar';

/**
 * The command IDs used by the codemirror plugin.
 */
namespace CommandIDs {
  export const changeKeyMap = 'codemirror:change-keymap';

  export const changeTheme = 'codemirror:change-theme';

  export const changeMode = 'codemirror:change-mode';

  export const find = 'codemirror:find';

  export const findAndReplace = 'codemirror:find-and-replace';

  export const goToLine = 'codemirror:go-to-line';
}

/**
 * The editor services.
 */
const services: JupyterFrontEndPlugin<IEditorServices> = {
  id: '@jupyterlab/codemirror-extension:services',
  provides: IEditorServices,
  activate: activateEditorServices
};

/**
 * The editor commands.
 */
const commands: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/codemirror-extension:commands',
  requires: [IEditorTracker, ISettingRegistry],
  optional: [IMainMenu],
  activate: activateEditorCommands,
  autoStart: true
};

/**
 * The JupyterLab plugin for the EditorSyntax status item.
 */
export const editorSyntaxStatus: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/codemirror-extension:editor-syntax-status',
  autoStart: true,
  requires: [IStatusBar, IEditorTracker, ILabShell],
  activate: (
    app: JupyterFrontEnd,
    statusBar: IStatusBar,
    tracker: IEditorTracker,
    labShell: ILabShell
  ) => {
    let item = new EditorSyntaxStatus({ commands: app.commands });
    labShell.currentChanged.connect(() => {
      const current = labShell.currentWidget;
      if (current && tracker.has(current)) {
        item.model.editor = (current as IDocumentWidget<
          FileEditor
        >).content.editor;
      }
    });
    statusBar.registerStatusItem(
      '@jupyterlab/codemirror-extension:editor-syntax-status',
      {
        item,
        align: 'left',
        rank: 0,
        isActive: () =>
          labShell.currentWidget &&
          tracker.currentWidget &&
          labShell.currentWidget === tracker.currentWidget
      }
    );
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  commands,
  services,
  editorSyntaxStatus
];
export default plugins;

/**
 * The plugin ID used as the key in the setting registry.
 */
const id = commands.id;

/**
 * Set up the editor services.
 */
function activateEditorServices(app: JupyterFrontEnd): IEditorServices {
  CodeMirror.prototype.save = () => {
    app.commands.execute('docmanager:save');
  };
  return editorServices;
}

/**
 * Set up the editor widget menu and commands.
 */
function activateEditorCommands(
  app: JupyterFrontEnd,
  tracker: IEditorTracker,
  settingRegistry: ISettingRegistry,
  mainMenu: IMainMenu | null
): void {
  const { commands, restored } = app;
  let {
    theme,
    keyMap,
    scrollPastEnd,
    styleActiveLine,
    styleSelectedText,
    selectionPointer
  } = CodeMirrorEditor.defaultConfig;

  /**
   * Update the setting values.
   */
  function updateSettings(settings: ISettingRegistry.ISettings): void {
    keyMap = (settings.get('keyMap').composite as string | null) || keyMap;
    theme = (settings.get('theme').composite as string | null) || theme;
    scrollPastEnd = settings.get('scrollPastEnd').composite as boolean | null;
    styleActiveLine =
      (settings.get('styleActiveLine').composite as boolean | object) ||
      styleActiveLine;
    styleSelectedText =
      (settings.get('styleSelectedText').composite as boolean) ||
      styleSelectedText;
    selectionPointer =
      (settings.get('selectionPointer').composite as boolean | string) ||
      selectionPointer;
  }

  /**
   * Update the settings of the current tracker instances.
   */
  function updateTracker(): void {
    tracker.forEach(widget => {
      if (widget.content.editor instanceof CodeMirrorEditor) {
        let cm = widget.content.editor.editor;
        cm.setOption('keyMap', keyMap);
        cm.setOption('theme', theme);
        cm.setOption('scrollPastEnd', scrollPastEnd);
        cm.setOption('styleActiveLine', styleActiveLine);
        cm.setOption('styleSelectedText', styleSelectedText);
        cm.setOption('selectionPointer', selectionPointer);
      }
    });
  }

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(id), restored])
    .then(([settings]) => {
      updateSettings(settings);
      updateTracker();
      settings.changed.connect(() => {
        updateSettings(settings);
        updateTracker();
      });
    })
    .catch((reason: Error) => {
      console.error(reason.message);
      updateTracker();
    });

  /**
   * Handle the settings of new widgets.
   */
  tracker.widgetAdded.connect((sender, widget) => {
    if (widget.content.editor instanceof CodeMirrorEditor) {
      let cm = widget.content.editor.editor;
      cm.setOption('keyMap', keyMap);
      cm.setOption('theme', theme);
      cm.setOption('scrollPastEnd', scrollPastEnd);
      cm.setOption('styleActiveLine', styleActiveLine);
      cm.setOption('styleSelectedText', styleSelectedText);
      cm.setOption('selectionPointer', selectionPointer);
    }
  });

  /**
   * A test for whether the tracker has an active widget.
   */
  function isEnabled(): boolean {
    return (
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget
    );
  }

  /**
   * Create a menu for the editor.
   */
  const themeMenu = new Menu({ commands });
  const keyMapMenu = new Menu({ commands });
  const modeMenu = new Menu({ commands });

  themeMenu.title.label = 'Text Editor Theme';
  keyMapMenu.title.label = 'Text Editor Key Map';
  modeMenu.title.label = 'Text Editor Syntax Highlighting';

  commands.addCommand(CommandIDs.changeTheme, {
    label: args => {
      if (args['theme'] === 'default') {
        return 'codemirror';
      } else {
        return args['theme'] as string;
      }
    },
    execute: args => {
      const key = 'theme';
      const value = (theme = (args['theme'] as string) || theme);

      updateTracker();
      return settingRegistry.set(id, key, value).catch((reason: Error) => {
        console.error(`Failed to set ${id}:${key} - ${reason.message}`);
      });
    },
    isToggled: args => args['theme'] === theme
  });

  commands.addCommand(CommandIDs.changeKeyMap, {
    label: args => {
      let title = args['keyMap'] as string;
      return title === 'sublime' ? 'Sublime Text' : title;
    },
    execute: args => {
      const key = 'keyMap';
      const value = (keyMap = (args['keyMap'] as string) || keyMap);

      updateTracker();
      return settingRegistry.set(id, key, value).catch((reason: Error) => {
        console.error(`Failed to set ${id}:${key} - ${reason.message}`);
      });
    },
    isToggled: args => args['keyMap'] === keyMap
  });

  commands.addCommand(CommandIDs.find, {
    label: 'Find...',
    execute: () => {
      let widget = tracker.currentWidget;
      if (!widget) {
        return;
      }
      let editor = widget.content.editor as CodeMirrorEditor;
      editor.execCommand('find');
    },
    isEnabled
  });

  commands.addCommand(CommandIDs.findAndReplace, {
    label: 'Find and Replace...',
    execute: () => {
      let widget = tracker.currentWidget;
      if (!widget) {
        return;
      }
      let editor = widget.content.editor as CodeMirrorEditor;
      editor.execCommand('replace');
    },
    isEnabled
  });

  commands.addCommand(CommandIDs.goToLine, {
    label: 'Go to Line...',
    execute: () => {
      let widget = tracker.currentWidget;
      if (!widget) {
        return;
      }
      let editor = widget.content.editor as CodeMirrorEditor;
      editor.execCommand('jumpToLine');
    },
    isEnabled
  });

  commands.addCommand(CommandIDs.changeMode, {
    label: args => args['name'] as string,
    execute: args => {
      let name = args['name'] as string;
      let widget = tracker.currentWidget;
      if (name && widget) {
        let spec = Mode.findByName(name);
        if (spec) {
          widget.content.model.mimeType = spec.mime;
        }
      }
    },
    isEnabled,
    isToggled: args => {
      let widget = tracker.currentWidget;
      if (!widget) {
        return false;
      }
      let mime = widget.content.model.mimeType;
      let spec = Mode.findByMIME(mime);
      let name = spec && spec.name;
      return args['name'] === name;
    }
  });

  Mode.getModeInfo()
    .sort((a, b) => {
      let aName = a.name || '';
      let bName = b.name || '';
      return aName.localeCompare(bName);
    })
    .forEach(spec => {
      // Avoid mode name with a curse word.
      if (spec.mode.indexOf('brainf') === 0) {
        return;
      }
      modeMenu.addItem({
        command: CommandIDs.changeMode,
        args: { ...spec }
      });
    });

  [
    'jupyter',
    'default',
    'abcdef',
    'base16-dark',
    'base16-light',
    'hopscotch',
    'material',
    'mbo',
    'mdn-like',
    'seti',
    'solarized dark',
    'solarized light',
    'the-matrix',
    'xq-light',
    'zenburn'
  ].forEach(name =>
    themeMenu.addItem({
      command: CommandIDs.changeTheme,
      args: { theme: name }
    })
  );

  ['default', 'sublime', 'vim', 'emacs'].forEach(name => {
    keyMapMenu.addItem({
      command: CommandIDs.changeKeyMap,
      args: { keyMap: name }
    });
  });

  if (mainMenu) {
    // Add some of the editor settings to the settings menu.
    mainMenu.settingsMenu.addGroup(
      [
        { type: 'submenu' as Menu.ItemType, submenu: keyMapMenu },
        { type: 'submenu' as Menu.ItemType, submenu: themeMenu }
      ],
      10
    );

    // Add the syntax highlighting submenu to the `View` menu.
    mainMenu.viewMenu.addGroup([{ type: 'submenu', submenu: modeMenu }], 40);

    // Add find-replace capabilities to the edit menu.
    mainMenu.editMenu.findReplacers.add({
      tracker,
      findAndReplace: (widget: IDocumentWidget<FileEditor>) => {
        let editor = widget.content.editor as CodeMirrorEditor;
        editor.execCommand('replace');
      }
    } as IEditMenu.IFindReplacer<IDocumentWidget<FileEditor>>);

    // Add go to line capabilities to the edit menu.
    mainMenu.editMenu.goToLiners.add({
      tracker,
      goToLine: (widget: IDocumentWidget<FileEditor>) => {
        let editor = widget.content.editor as CodeMirrorEditor;
        editor.execCommand('jumpToLine');
      }
    } as IEditMenu.IGoToLiner<IDocumentWidget<FileEditor>>);
  }
}
