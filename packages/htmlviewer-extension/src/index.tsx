/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, InstanceTracker } from '@jupyterlab/apputils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { HTMLViewer, HTMLViewerFactory } from '@jupyterlab/htmlviewer';

/**
 * The CSS class for an HTML5 icon.
 */
const CSS_ICON_CLASS = 'jp-MaterialIcon jp-HTMLIcon';

import '../style/index.css';

/**
 * Command IDs used by the plugin.
 */
namespace CommandIDs {
  export const trustHTML = 'htmlviewer:trust-html';
}

/**
 * The HTML file handler extension.
 */
const htmlPlugin: JupyterFrontEndPlugin<void> = {
  activate: activateHTMLViewer,
  id: '@jupyterlab/htmlviewer-extension:plugin',
  optional: [ICommandPalette, ILayoutRestorer],
  autoStart: true
};

/**
 * Activate the HTMLViewer extension.
 */
function activateHTMLViewer(
  app: JupyterFrontEnd,
  palette: ICommandPalette | null,
  restorer: ILayoutRestorer | null
): void {
  // Add an HTML file type to the docregistry.
  const ft: DocumentRegistry.IFileType = {
    name: 'html',
    contentType: 'file',
    fileFormat: 'text',
    displayName: 'HTML File',
    extensions: ['.html'],
    mimeTypes: ['text/html'],
    iconClass: CSS_ICON_CLASS
  };
  app.docRegistry.addFileType(ft);

  // Create a new viewer factory.
  const factory = new HTMLViewerFactory({
    name: 'HTML Viewer',
    fileTypes: ['html'],
    defaultFor: ['html'],
    readOnly: true
  });

  // Create an instance tracker for HTML documents.
  const tracker = new InstanceTracker<HTMLViewer>({
    namespace: 'htmlviewer'
  });

  // Handle state restoration.
  if (restorer) {
    restorer.restore(tracker, {
      command: 'docmanager:open',
      args: widget => ({ path: widget.context.path, factory: 'HTML Viewer' }),
      name: widget => widget.context.path
    });
  }

  app.docRegistry.addWidgetFactory(factory);
  factory.widgetCreated.connect((sender, widget) => {
    // Track the widget.
    tracker.add(widget);
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    });
    // Notify the application when the trust state changes so it
    // can update any renderings of the trust command.
    widget.trustedChanged.connect(() => {
      app.commands.notifyCommandChanged(CommandIDs.trustHTML);
    });

    widget.title.iconClass = ft.iconClass;
    widget.title.iconLabel = ft.iconLabel;
  });

  // Add a command to trust the active HTML document,
  // allowing script executions in its context.
  app.commands.addCommand(CommandIDs.trustHTML, {
    label: 'Trust HTML File',
    isEnabled: () => !!tracker.currentWidget,
    isToggled: () => {
      const current = tracker.currentWidget;
      if (!current) {
        return false;
      }
      const sandbox = current.content.sandbox;
      return sandbox.indexOf('allow-scripts') !== -1;
    },
    execute: () => {
      const current = tracker.currentWidget;
      if (!current) {
        return false;
      }
      current.trusted = !current.trusted;
    }
  });
  if (palette) {
    palette.addItem({
      command: CommandIDs.trustHTML,
      category: 'File Operations'
    });
  }
}
/**
 * Export the plugins as default.
 */
export default htmlPlugin;
