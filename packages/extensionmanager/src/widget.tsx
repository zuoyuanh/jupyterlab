// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { VDomRenderer, ToolbarButtonComponent } from '@jupyterlab/apputils';

import { ServiceManager } from '@jupyterlab/services';

import { Message } from '@phosphor/messaging';

import { Button, InputGroup, Collapse } from '@jupyterlab/ui-components';

import * as React from 'react';

import ReactPaginate from 'react-paginate';

import { ListModel, IEntry, Action } from './model';

import { isJupyterOrg } from './query';

// TODO: Replace pagination with lazy loading of lower search results

/**
 * Search bar VDOM component.
 */
export class SearchBar extends React.Component<
  SearchBar.IProperties,
  SearchBar.IState
> {
  constructor(props: SearchBar.IProperties) {
    super(props);
    this.state = {
      value: ''
    };
  }

  /**
   * Render the list view using the virtual DOM.
   */
  render(): React.ReactNode {
    return (
      <div className="jp-extensionmanager-search-bar">
        <InputGroup
          className="jp-extensionmanager-search-wrapper"
          type="text"
          placeholder={this.props.placeholder}
          onChange={this.handleChange}
          value={this.state.value}
          rightIcon="search"
        />
      </div>
    );
  }

  /**
   * Handler for search input changes.
   */
  handleChange = (e: React.FormEvent<HTMLElement>) => {
    let target = e.target as HTMLInputElement;
    this.setState({
      value: target.value
    });
  };
}

/**
 * The namespace for search bar statics.
 */
export namespace SearchBar {
  /**
   * React properties for search bar component.
   */
  export interface IProperties {
    /**
     * The placeholder string to use in the search bar input field when empty.
     */
    placeholder: string;
  }

  /**
   * React state for search bar component.
   */
  export interface IState {
    /**
     * The value of the search bar input field.
     */
    value: string;
  }
}

/**
 * Create a build prompt as a react element.
 *
 * @param props Configuration of the build prompt.
 */
function BuildPrompt(props: BuildPrompt.IProperties): React.ReactElement<any> {
  return (
    <div className="jp-extensionmanager-buildprompt">
      <div className="jp-extensionmanager-buildmessage">
        A build is needed to include the latest changes
      </div>
      <Button onClick={props.performBuild} minimal small>
        Rebuild
      </Button>
      <Button onClick={props.ignoreBuild} minimal small>
        Ignore
      </Button>
    </div>
  );
}

/**
 * The namespace for build prompt statics.
 */
namespace BuildPrompt {
  /**
   * Properties for build prompt react component.
   */
  export interface IProperties {
    /**
     * Callback for when a build is requested.
     */
    performBuild: () => void;

    /**
     * Callback for when a build notice is dismissed.
     */
    ignoreBuild: () => void;
  }
}

/**
 * VDOM for visualizing an extension entry.
 */
function ListEntry(props: ListEntry.IProperties): React.ReactElement<any> {
  const { entry } = props;
  const flagClasses = [];
  if (entry.status && ['ok', 'warning', 'error'].indexOf(entry.status) !== -1) {
    flagClasses.push(`jp-extensionmanager-entry-${entry.status}`);
  }
  let title = entry.name;
  if (isJupyterOrg(entry.name)) {
    flagClasses.push(`jp-extensionmanager-entry-mod-whitelisted`);
    title = `${entry.name} (Developed by Project Jupyter)`;
  }
  return (
    <li
      className={`jp-extensionmanager-entry ${flagClasses.join(' ')}`}
      title={title}
    >
      <div className="jp-extensionmanager-entry-title">
        <div className="jp-extensionmanager-entry-name">
          <a href={entry.url} target="_blank" rel="noopener">
            {entry.name}
          </a>
        </div>
        <div className="jp-extensionmanager-entry-jupyter-org" />
      </div>
      <div className="jp-extensionmanager-entry-content">
        <div className="jp-extensionmanager-entry-description">
          {entry.description}
        </div>
        <div className="jp-extensionmanager-entry-buttons">
          {!entry.installed && (
            <Button
              onClick={() => props.performAction('install', entry)}
              minimal
              small
            >
              Install
            </Button>
          )}
          {ListModel.entryHasUpdate(entry) && (
            <Button
              onClick={() => props.performAction('install', entry)}
              minimal
              small
            >
              Update
            </Button>
          )}
          {entry.installed && (
            <Button
              onClick={() => props.performAction('uninstall', entry)}
              minimal
              small
            >
              Uninstall
            </Button>
          )}
          {entry.enabled && (
            <Button
              onClick={() => props.performAction('enable', entry)}
              minimal
              small
            >
              Enable
            </Button>
          )}
          {!entry.enabled && (
            <Button
              onClick={() => props.performAction('disable', entry)}
              minimal
              small
            >
              Disable
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The namespace for extension entry statics.
 */
export namespace ListEntry {
  export interface IProperties {
    /**
     * The entry to visualize.
     */
    entry: IEntry;

    /**
     * Callback to use for performing an action on the entry.
     */
    performAction: (action: Action, entry: IEntry) => void;
  }
}

/**
 * List view widget for extensions
 */
export function ListView(props: ListView.IProperties): React.ReactElement<any> {
  const entryViews = [];
  for (let entry of props.entries) {
    entryViews.push(
      <ListEntry
        entry={entry}
        key={entry.name}
        performAction={props.performAction}
      />
    );
  }
  let pagination;
  if (props.numPages > 1) {
    pagination = (
      <div className="jp-extensionmanager-pagination">
        <ReactPaginate
          previousLabel={'<'}
          nextLabel={'>'}
          breakLabel={<a href="">...</a>}
          breakClassName={'break-me'}
          pageCount={props.numPages}
          marginPagesDisplayed={2}
          pageRangeDisplayed={5}
          onPageChange={(data: { selected: number }) =>
            props.onPage(data.selected)
          }
          containerClassName={'pagination'}
          activeClassName={'active'}
        />
      </div>
    );
  }
  const listview = (
    <ul className="jp-extensionmanager-listview">{entryViews}</ul>
  );
  return (
    <div className="jp-extensionmanager-listview-wrapper">
      {entryViews.length > 0 ? (
        listview
      ) : (
        <div key="message" className="jp-extensionmanager-listview-message">
          No entries
        </div>
      )}
      {pagination}
    </div>
  );
}

/**
 * The namespace for list view widget statics.
 */
export namespace ListView {
  export interface IProperties {
    /**
     * The extension entries to display.
     */
    entries: ReadonlyArray<IEntry>;

    /**
     * The number of pages that can be viewed via pagination.
     */
    numPages: number;

    /**
     * The callback to use for changing the page
     */
    onPage: (page: number) => void;

    /**
     * Callback to use for performing an action on an entry.
     */
    performAction: (action: Action, entry: IEntry) => void;
  }
}

function ErrorMessage(props: ErrorMessage.IProperties) {
  return (
    <div key="error-msg" className="jp-extensionmanager-error">
      {props.children}
    </div>
  );
}

namespace ErrorMessage {
  export interface IProperties {
    children: React.ReactNode;
  }
}

/**
 *
 */
export class CollapsibleSection extends React.Component<
  CollapsibleSection.IProperties,
  CollapsibleSection.IState
> {
  constructor(props: CollapsibleSection.IProperties) {
    super(props);
    this.state = {
      isOpen: props.isOpen || true
    };
  }

  /**
   * Render the collapsible section using the virtual DOM.
   */
  render(): React.ReactNode {
    return (
      <>
        <header>
          <ToolbarButtonComponent
            iconClassName={
              'jp-Icon jp-Icon-16 ' +
              (this.state.isOpen
                ? 'jp-extensionmanager-expandIcon'
                : 'jp-extensionmanager-collapseIcon')
            }
            onClick={() => {
              this.handleCollapse();
            }}
          />
          <span className="jp-extensionmanager-headerText">
            {this.props.header}
          </span>
          {this.props.headerElements}
        </header>
        <Collapse isOpen={this.state.isOpen}>{this.props.children}</Collapse>
      </>
    );
  }

  /**
   * Handler for search input changes.
   */
  handleCollapse() {
    this.setState(
      {
        isOpen: !this.state.isOpen
      },
      () => {
        if (this.props.onCollapse) {
          this.props.onCollapse(this.state.isOpen);
        }
      }
    );
  }
}

/**
 * The namespace for collapsible section statics.
 */
export namespace CollapsibleSection {
  /**
   * React properties for collapsible section component.
   */
  export interface IProperties {
    /**
     * The header string for section list.
     */
    header: string;

    /**
     * Whether the view will be expanded or collapsed initially, defaults to open.
     */
    isOpen?: boolean;

    /**
     * Handle collapse event.
     */
    onCollapse?: (isOpen: boolean) => void;

    /**
     * Any additional elements to add to the header.
     */
    headerElements?: React.ReactNode;

    /**
     * If given, this will be diplayed instead of the children.
     */
    errorMessage?: string | null;
  }

  /**
   * React state for collapsible section component.
   */
  export interface IState {
    /**
     * Whether the section is expanded or collapsed.
     */
    isOpen: boolean;
  }
}

/**
 * The main view for the discovery extension.
 */
export class ExtensionView extends VDomRenderer<ListModel> {
  constructor(serviceManager: ServiceManager) {
    super();
    this.model = new ListModel(serviceManager);
    this.addClass('jp-extensionmanager-view');
  }

  /**
   * The search input node.
   */
  get inputNode(): HTMLInputElement {
    return this.node.querySelector(
      '.jp-extensionmanager-search-wrapper input'
    ) as HTMLInputElement;
  }

  /**
   * Render the extension view using the virtual DOM.
   */
  protected render(): React.ReactElement<any>[] {
    const model = this.model!;
    let pages = Math.ceil(model.totalEntries / model.pagination);
    let elements = [<SearchBar key="searchbar" placeholder="SEARCH" />];
    if (model.promptBuild) {
      elements.push(
        <BuildPrompt
          key="buildpromt"
          performBuild={() => {
            model.performBuild();
          }}
          ignoreBuild={() => {
            model.ignoreBuildRecommendation();
          }}
        />
      );
    }
    // Indicator element for pending actions:
    elements.push(
      <div
        key="pending"
        className={`jp-extensionmanager-pending ${
          model.hasPendingActions() ? 'jp-mod-hasPending' : ''
        }`}
      />
    );
    const content = [];
    if (!model.initialized) {
      model.initialize();
      content.push(
        <div key="loading-placeholder" className="jp-extensionmanager-loader">
          Updating extensions list
        </div>
      );
    } else if (model.serverConnectionError !== null) {
      content.push(
        <ErrorMessage key="error-msg">
          <p>
            Error communicating with server extension. Consult the documentation
            for how to ensure that it is enabled.
          </p>

          <p>Reason given:</p>
          <pre>{model.serverConnectionError}</pre>
        </ErrorMessage>
      );
    } else if (model.serverRequirementsError !== null) {
      content.push(
        <ErrorMessage key="server-requirements-error">
          <p>
            The server has some missing requirements for installing extensions.
          </p>

          <p>Details:</p>
          <pre>{model.serverRequirementsError}</pre>
        </ErrorMessage>
      );
    } else {
      // List installed and discovery sections

      let installedContent = [];
      if (model.installedError !== null) {
        installedContent.push(
          <ErrorMessage key="install-error">
            {`Error querying installed extensions${
              model.installedError ? `: ${model.installedError}` : '.'
            }`}
          </ErrorMessage>
        );
      } else {
        installedContent.push(
          <ListView
            key="installed-items"
            entries={model.installed}
            numPages={1}
            onPage={value => {
              /* no-op */
            }}
            performAction={this.onAction.bind(this)}
          />
        );
      }

      content.push(
        <CollapsibleSection
          key="installed-section"
          isOpen={true}
          header="Installed"
          headerElements={
            <ToolbarButtonComponent
              key="refresh-button"
              className="jp-extensionmanager-refresh"
              iconClassName="jp-RefreshIcon jp-Icon jp-Icon-16"
              onClick={() => {
                model.refreshInstalled();
              }}
              tooltip="Refresh extension list"
            />
          }
        >
          {installedContent}
        </CollapsibleSection>
      );

      let searchContent = [];
      if (model.searchError !== null) {
        searchContent.push(
          <ErrorMessage key="search-error">
            {`Error searching for extensions${
              model.searchError ? `: ${model.searchError}` : '.'
            }`}
          </ErrorMessage>
        );
      } else {
        searchContent.push(
          <ListView
            key="search-items"
            // Filter out installed extensions:
            entries={model.searchResult.filter(
              entry => model.installed.indexOf(entry) === -1
            )}
            numPages={pages}
            onPage={value => {
              this.onPage(value);
            }}
            performAction={this.onAction.bind(this)}
          />
        );
      }

      content.push(
        <CollapsibleSection
          key="search-section"
          isOpen={false}
          header={model.query ? 'Search Results' : 'Discover'}
          onCollapse={(isOpen: boolean) => {
            if (isOpen && model.query === null) {
              model.query = '';
            }
          }}
        >
          {searchContent}
        </CollapsibleSection>
      );
    }

    elements.push(
      <div key="content" className="jp-extensionmanager-content">
        {content}
      </div>
    );
    return elements;
  }

  /**
   * Callback handler for the user specifies a new search query.
   *
   * @param value The new query.
   */
  onSearch(value: string) {
    this.model!.query = value;
  }

  /**
   * Callback handler for the user changes the page of the search result pagination.
   *
   * @param value The pagination page number.
   */
  onPage(value: number) {
    this.model!.page = value;
  }

  /**
   * Callback handler for when the user wants to perform an action on an extension.
   *
   * @param action The action to perform.
   * @param entry The entry to perform the action on.
   */
  onAction(action: Action, entry: IEntry) {
    switch (action) {
      case 'install':
        return this.model!.install(entry);
      case 'uninstall':
        return this.model!.uninstall(entry);
      case 'enable':
        return this.model!.enable(entry);
      case 'disable':
        return this.model!.disable(entry);
      default:
        throw new Error(`Invalid action: ${action}`);
    }
  }

  /**
   * Handle the DOM events for the command palette.
   *
   * @param event - The DOM event sent to the command palette.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the command palette's DOM node.
   * It should not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'input':
        this.onSearch(this.inputNode.value);
        break;
      case 'focus':
      case 'blur':
        this._toggleFocused();
        break;
      default:
        break;
    }
  }

  /**
   * A message handler invoked on a `'before-attach'` message.
   */
  protected onBeforeAttach(msg: Message): void {
    this.node.addEventListener('input', this);
    this.node.addEventListener('focus', this, true);
    this.node.addEventListener('blur', this, true);
  }

  /**
   * A message handler invoked on an `'after-detach'` message.
   */
  protected onAfterDetach(msg: Message): void {
    this.node.removeEventListener('input', this);
    this.node.removeEventListener('focus', this, true);
    this.node.removeEventListener('blur', this, true);
  }

  /**
   * A message handler invoked on an `'activate-request'` message.
   */
  protected onActivateRequest(msg: Message): void {
    if (this.isAttached) {
      let input = this.inputNode;
      input.focus();
      input.select();
    }
  }

  /**
   * Toggle the focused modifier based on the input node focus state.
   */
  private _toggleFocused(): void {
    let focused = document.activeElement === this.inputNode;
    this.toggleClass('p-mod-focused', focused);
  }
}
