import * as React from 'react';
import { StyleSheet, css } from 'aphrodite';
import {withStyles, createStyles, Theme} from '@material-ui/core/styles';
import { commonTypes } from '../../../common';
import { appTypes, Segment } from '../../features/app';
import { authTypes } from '../../features/auth';
import { prefTypes, prefColors, withPreferences } from '../../features/preferences';
import { filelistTypes, fileActions, fileUtils } from '../../features/filelist'
import { packiTypes, packiValids /*, packiDefaults*/ } from '../../features/packi';
import { wizziTypes } from '../../features/wizzi';
import FileList from '../filelist/FileList'
import KeybindingsManager from '../shared/KeybindingsManager'
import LazyLoad from '../shared/LazyLoad'
import ModalDialog from '../shared/MuiModalDialog'
import ProgressIndicator from '../shared/ProgressIndicator'
import ContentShell from '../Shell/ContentShell'
import LayoutShell from '../Shell/LayoutShell'
import EditorShell from '../Shell/EditorShell'
import AssetViewer from './AssetViewer';
import EditorPanels from './EditorPanels'
import EditorToolbar from './EditorToolbar'
import EditorFooter from './EditorFooter'
import EditorForm from '../../features/form/EditorForm'
import NoFileSelected from './NoFileSelected'
import KeyboardShortcuts, { Shortcuts } from './KeyboardShortcuts';
import PackiManager from '../../containers/PackiManager';
import PreviousSaves from './PreviousSaves';
import GeneratedView from './GeneratedView';
import GenerationErrors from './GenerationErrors';
import mockFn from '../../mocks/functions'

const EDITOR_LOAD_FALLBACK_TIMEOUT = 3000;

type EditorProps = authTypes.AuthProps & {
    classes: any,
    currentPacki?: packiTypes.Packi;
    generatedArtifact?: wizziTypes.GeneratedArtifact;
    saveHistory: packiTypes.SaveHistory;
    saveStatus: packiTypes.SaveStatus;
    creatorUsername?: string;
    fileEntries: filelistTypes.FileSystemEntry[];
    entry: filelistTypes.TextFileEntry | filelistTypes.AssetFileEntry | undefined;
    params: {
      id?: string;
      // platform?: 'android' | 'ios';
    };
    // loadingMessage: string | undefined;
    jobError: wizziTypes.JobError;
    isWizziJobWaiting: boolean;
    onSelectPacki: (packiId: string) => void;
    onCreatePacki: (packiId: string, packiKind: string) => void;
    onDeletePacki: (packiId: string) => void;
    onFileEntriesChange: (entries: filelistTypes.FileSystemEntry[]) => Promise<void>;
    onChangeCode: (code: string) => void;
    onEntrySelected: (entry: filelistTypes.FileSystemEntry) => void;
    onExecuteWizziJob: () => void;
    onSaveCode: () => void;
    /*
    onSubmitMetadata: (
      details: {
        name: string;
        description: string;
      },
      draft?: boolean
    ) => Promise<void>;
    uploadFileAsync: (file: File) => Promise<string>;
    syncDependenciesAsync: (
      modules: {
        [name: string]: string | undefined;
      },
      onError: (name: string, e: Error) => void
    ) => Promise<void>;
    */
    userAgent: string;
}

export type Props = prefTypes.PreferencesContextType &
  EditorProps & {
    loggedUser?: appTypes.LoggedUser;
  };

type ModalName =
  | 'auth'  
  | 'packi-manager'
  | 'github-commit'
  | 'github-create'
  | 'edit-info'
  | 'shortcuts'
  | 'previous-saves';

type BannerName =
  | 'connected'
  | 'disconnected'
  | 'reconnect'
  | 'autosave-disabled'
  | 'slow-connection';

type SplitViewKind =
  | 'left' 
  | 'right' 
  | 'both';

  type State = {
  currentModal: ModalName | null;
  currentBanner: BannerName | null;
  loadedEditor: 'monaco' | 'simple' | null;
  isDownloading: boolean;
  isMarkdownPreview: boolean;
  // lintErrors: Annotation[];
  previousEntry: filelistTypes.TextFileEntry | filelistTypes.AssetFileEntry | undefined;
  splitViewKind: SplitViewKind;
};

// const BANNER_TIMEOUT_SHORT = 1500;
// const BANNER_TIMEOUT_LONG = 5000;

class EditorView extends React.Component<Props, State> {
    
    static getDerivedStateFromProps(props: Props, state: State) {
      if (props.entry !== state.previousEntry) {
        const { entry } = props;
        const { previousEntry } = state;

        if (entry) { props.onEntrySelected(entry); }
  
        let isMarkdownPreview = state.isMarkdownPreview;
  
        if (
          entry &&
          (!previousEntry || entry.item.path !== previousEntry.item.path) &&
          // When an empty markdown file is opened, switch to edit mode
          (entry.item.type === 'file' &&
            entry.item.path.endsWith('.md') &&
            !entry.item.asset &&
            !(entry as filelistTypes.TextFileEntry).item.content)
        ) {
          isMarkdownPreview = false;
        }
        return {
          isMarkdownPreview,
          previousEntry: entry,
        };
      }
  
      return null;
    }
  
    state = {
      loadedEditor: null,
      currentModal: null,
      currentBanner: null,
      isDownloading: false,
      isMarkdownPreview: true,
      previousEntry: undefined,
      splitViewKind: 'both' as SplitViewKind,
    };

    componentDidMount() {
    }

    _handleChangeSplitViewKind = (e: React.ChangeEvent<HTMLSelectElement>) => {
        this.setState({ splitViewKind: e.target.value as SplitViewKind});  
    }

    _handleDismissEditModal = () => {
      Segment.getInstance().logEvent('DISMISSED_AUTH_MODAL', {
        currentModal: this.state.currentModal,
      });
      this.setState({ currentModal: null });
    };
  
    _handleShowTitleDescriptionModal = () => {
      this.setState({ currentModal: 'edit-info' });
    };
  
    _handleShowPackiManager = () => {
      this.setState({ currentModal: 'packi-manager' });
    };

    _handleShowGithubCommit = () => {
      this.setState({ currentModal: 'github-commit' });
    };

    _handleShowGithubCreate = () => {
      this.setState({ currentModal: 'github-create' });
    };

    _handleShowAuthModal = () => {
      this.setState({ currentModal: 'auth' });
    };
  
    _handleShowShortcuts = () => {
      console.log("_handleShowShortcuts");
      this.setState({ currentModal: 'shortcuts' });
    };
  
    _handleShowPreviousSaves = () => {
      this.setState({ currentModal: 'previous-saves' });
    };
  
    _handleHideModal = () => {
      this.setState({ currentModal: null });
    };
  
    _handleShowModal = (name: any) => {
      this.setState({ currentModal: name });
    };
  
    _handleSelectPacki = (id: string) => {
      this._handleDismissEditModal();
      this.props.onSelectPacki && this.props.onSelectPacki(id);
    };

    _handleCreatePacki = (id: string, kind: string) => {
      this._handleDismissEditModal();
      this.props.onCreatePacki && this.props.onCreatePacki(id, kind);
    };

    _handleDeletePacki = (id: string) => {
      this.props.onDeletePacki && this.props.onDeletePacki(id);
    };

    _handleCreateGitRepository = (owner: string, name: string, branch: string) => {
      this._handleDismissEditModal();
      // this.props.onCreateGitRepository && this.props.onCommitGitRepository(owner, name, branch);
    };

    _handleOpenPath = (path: string): Promise<void> =>
      this.props.onFileEntriesChange(fileActions.openEntry(this.props.fileEntries, path, true));
  
    _handleRemoveFile = (path: string) => {
      const entry = this.props.fileEntries.find(({ item }) => item.path === path);
  
      if (entry && entry.item.type === 'folder') {
        this.props.fileEntries.forEach(({ item }) => {
          if (fileUtils.isInsideFolder(item.path, path)) {
            this._EditorComponent && this._EditorComponent.removePath(item.path);
          }
        });
      } else {
        this._EditorComponent && this._EditorComponent.removePath(path);
      }
    };
  
    _handleRenameFile = (oldPath: string, newPath: string) => {
      const entry = this.props.fileEntries.find(({ item }) => item.path === oldPath);
  
      if (entry && entry.item.type === 'folder') {
        this.props.fileEntries.forEach(({ item }) => {
          if (fileUtils.isInsideFolder(item.path, oldPath)) {
            const renamedPath = fileUtils.changeParentPath(item.path, oldPath, newPath);
  
            this._EditorComponent && this._EditorComponent.renamePath(item.path, renamedPath);
          }
        });
      } else {
        this._EditorComponent && this._EditorComponent.renamePath(oldPath, newPath);
      }
    };

    _EditorComponent: any;

    _showErrorPanel = () =>
      this.props.setPreferences({
        panelType: 'errors',
      });
  
    _togglePanels = () =>
      this.props.setPreferences({
        panelsShown: !this.props.preferences.panelsShown,
      });
  
    _toggleFileTree = () =>
      this.props.setPreferences({
        fileTreeShown: !this.props.preferences.fileTreeShown,
      });
  
    _toggleTheme = () =>
      this.props.setPreferences({
        theme: this.props.preferences.theme === 'light' ? 'dark' : 'light',
      });
  
    _toggleMarkdownPreview = () =>
      this.setState(state => ({ isMarkdownPreview: !state.isMarkdownPreview }));
  
    render() {
      const { currentModal/*, currentBanner*/, isDownloading } = this.state;

      const {
        classes,
        currentPacki,
        entry,
        // params,
        generatedArtifact,
        saveHistory,
        saveStatus,
        loggedUser,
        // loadingMessage,
        jobError,
        isWizziJobWaiting,
        onLoggedOn,
        onLoggedOff,
        onExecuteWizziJob,
        onSaveCode,
        // uploadFileAsync,
        preferences,
      } = this.props;

      // console.log('EditorView', generatedArtifact);
      // console.log('EditorView.currentPacki', currentPacki);
  
      // const annotations: Annotation[] = [];
  
      /*
      if (deviceError) {
        annotations.push(convertErrorToAnnotation(deviceError));
      }
      */
  
      //const hasPackiId = !!params.id;
      //const metadataName = isIntentionallyNamed(name) ? packiDefaults.DEFAULT_METADATA_NAME : name;
      /*
      const metadataName = name == packiDefaults.DEFAULT_PACKI_NAME ? packiDefaults.DEFAULT_METADATA_NAME : name;
      const metadataDescription =
        description === packiDefaults.DEFAULT_DESCRIPTION
          ? hasPackiId
            ? packiDefaults.DEFAULT_METADATA_DESCRIPTION_SAVED
            : packiDefaults.DEFAULT_METADATA_DESCRIPTION_EMPTY
          : description;*/
  
      const {fileEntries} = this.props;
      if (fileEntries.length == 0) {
        // return (<h1>loading ...</h1>)
      }

      return (
        <ContentShell>
          {this.state.loadedEditor ? null : <ProgressIndicator />}
          {/*<PageMetadata name={metadataName} description={metadataDescription} params={params} />*/}
          <React.Fragment>
            <KeybindingsManager
              bindings={Shortcuts}
              onTrigger={type => {
                const commands: { [key: string]: (() => void) | null } = {
                  /*
                  save:
                    saveStatus === 'published'
                      ? null
                      : this.props.isResolving
                      ? null
                      : onPublishAsync,*/
                  tree: this._toggleFileTree,
                  panels: this._togglePanels,
                  // format: this._prettier,
                  shortcuts: this._handleShowShortcuts,
                };
                const fn = commands[type];
                if (fn) {
                  fn();
                }
              }}
            />
            <EditorToolbar
              // name={name}
              // description={description}
              creatorUsername={this.props.creatorUsername}
              loggedUser={loggedUser}
              currentPacki={currentPacki}
              splitViewKind={this.state.splitViewKind}
              saveHistory={saveHistory}
              saveStatus={saveStatus}
              isDownloading={isDownloading}
              // isResolving={this.props.isResolving}
              isEditModalVisible={currentModal === 'edit-info'}
              isAuthModalVisible={currentModal === 'auth'}
              isWizziJobWaiting={isWizziJobWaiting}
              onChangeSplitViewKind={this._handleChangeSplitViewKind}
              onLoggedOn={onLoggedOn}
              onLoggedOff={onLoggedOff}
              onShowPreviousSaves={this._handleShowPreviousSaves}
              onShowEditModal={this._handleShowTitleDescriptionModal}
              onDismissEditModal={this._handleDismissEditModal}
              // onSubmitMetadata={this.props.onSubmitMetadata}
              onShowAuthModal={this._handleShowAuthModal}
              onDismissAuthModal={this._handleHideModal}
              onExecuteWizziJob={onExecuteWizziJob}
              onShowPackiManager={this._handleShowPackiManager}
              onShowGithubCommit={this._handleShowGithubCommit}
              onShowGithubCreate={this._handleShowGithubCreate}
              onSaveCode={onSaveCode}
              // onDownloadCode={handleDownloadCode}
              // onPublishAsync={onPublishAsync}
              
            />
            <div className={css(styles.editorAreaOuterWrapper)}>
                <div className={css(styles.editorAreaOuter)}>
                  <LayoutShell>
                  <FileList 
                    entries={fileEntries}
                    visible={true}
                    onEntriesChange={this.props.onFileEntriesChange}
                    onRemoveFile={(path: string) => path}
                    onRenameFile={(oldPath: string, newPath: string) => { oldPath && newPath }}
                    uploadFileAsync={(file: File) =>  mockFn.promise<string>(file)}
                    onDownloadCode={() => mockFn.promise<void>()}
                    hasSnackId={false}
                    saveStatus={'changed'}
                    // sdkVersion: SDKVersion;
                    // theme={'light'}
                    preventRedirectWarning={() => null}
                    >
                  </FileList>
                  {/* Don't load it conditionally since we need the _EditorComponent object to be available */}
                  { (this.state.splitViewKind == 'both' || this.state.splitViewKind == 'left') &&
                  <LazyLoad
                    load={(): Promise<typeof import('./MonacoEditor')> => {
                      let timeout: any;
                      const MonacoEditorPromise = import(/* webpackPreload: true */ './MonacoEditor').then(
                        editor => ({ editor, type: 'monaco' })
                      );
                      return MonacoEditorPromise.then(({ editor, type }: any) => {
                        this.setState({ loadedEditor: type });
                        clearTimeout(timeout);
                        return editor;
                      }).catch(err=>{ console.log(err); alert('Failed to load Monaco Editor. See console error.')});
                    }}>
                    {({ loaded, data: Comp }) => {
                      this._EditorComponent = Comp;

                      if (entry && entry.item.type === 'file') {
                        if (entry.item.asset) {
                          return <AssetViewer entry={(entry as any) as filelistTypes.AssetFileEntry} />;
                        }

                        const { content } = (entry as filelistTypes.TextFileEntry).item ;
                        // const isMarkdown = entry.item.path.endsWith('.md');
                      
                        if (loaded && Comp) {
                          return (
                            <React.Fragment>
                              <Comp
                                dependencies={{}/*this.props.dependencies*/}
                                //sdkVersion={sdkVersion}
                                entries={fileEntries/*this.props.fileEntries*/}
                                autoFocus={!entry.state.isCreating}
                                annotations={[]/*annotations*/}
                                path={entry.item.path}
                                value={content}
                                onValueChange={this.props.onChangeCode}
                                onOpenPath={this._handleOpenPath}
                              />
                            </React.Fragment>
                          );
                        }
                      } else {
                        return <NoFileSelected />;
                      }
                      return <EditorShell />;
                    }}
                  </LazyLoad> }
                  { ((this.state.splitViewKind == 'both' || this.state.splitViewKind == 'right') &&
                    generatedArtifact) && generatedArtifact.artifactContent ? (
                    <GeneratedView
                        generatedContent={generatedArtifact.artifactContent}
                        generatedSourcePath={generatedArtifact.sourcePath}
                        splitViewKind={this.state.splitViewKind}
                      />) : generatedArtifact && generatedArtifact.errorLines ? (
                    <GenerationErrors
                        errorName={generatedArtifact.errorName}
                        errorLines={generatedArtifact.errorLines}
                        errorMessage={generatedArtifact.errorMessage}
                        errorStack={generatedArtifact.errorStack}
                      />) : null }
                  { jobError ? (
                    <GenerationErrors
                        errorName={jobError.errorName}
                        errorLines={[]}
                        errorMessage={jobError.errorMessage}
                        errorStack={jobError.errorStack}
                      />) : null }
                  </LayoutShell>
                  {preferences.panelsShown ? (
                      <EditorPanels
                        //annotations={annotations}
                        onShowErrorPanel={this._showErrorPanel}
                        onTogglePanels={this._togglePanels}
                        panelType={preferences.panelType}
                      />
                  ) : null}
              </div>
            </div>
            <EditorFooter
              // loadingMessage={loadingMessage}
              // annotations={annotations}
              loggedUid={preferences.loggedUid}
              autoGenSingleDoc={preferences.autoGenSingleDoc}
              autoExecJob={preferences.autoExecJob}
              connectGithubRepos={preferences.connectGithubRepos}
              trustLocalStorage={preferences.trustLocalStorage}
              fileTreeShown={preferences.fileTreeShown}
              panelsShown={preferences.panelsShown}
              onToggleTheme={this._toggleTheme}
              onTogglePanels={this._togglePanels}
              onToggleFileTree={this._toggleFileTree}
              onShowShortcuts={this._handleShowShortcuts}
              // onPrettifyCode={this._prettier}
              theme={this.props.preferences.theme}
            />
            { loggedUser && (
              <ModalDialog
                title="Manage your packies"
                visible={currentModal === 'packi-manager'}
                onDismiss={this._handleHideModal}>
                <PackiManager onClose={this._handleHideModal}> </PackiManager>
              </ModalDialog>
            )}
            <ModalDialog
              visible={currentModal === 'previous-saves'}
              title="Previous saves"
              onDismiss={this._handleHideModal}>
              <PreviousSaves saveHistory={saveHistory} />
            </ModalDialog>
            <ModalDialog
              title="Shortcuts"
              visible={currentModal === 'shortcuts'}
              onDismiss={this._handleHideModal}>
              <KeyboardShortcuts />
            </ModalDialog>
            { currentPacki && currentPacki.localPackiData && (
              <ModalDialog
                title="Commit/push git package"
                visible={currentModal === 'github-commit'}
                onDismiss={this._handleHideModal}>
                <EditorForm
                  title="Commit/push git package"
                  action="Done"
                  visible={true}
                  onDismiss={this._handleHideModal}
                  onSubmit={values => {
                    alert(JSON.stringify(values));
                    //TODO this._handleCommitGitRepository(values['owner'], values['repoName'], values['branch']);
                  }}
                  fields={{
                    owner: {type: 'text', label: 'Owner', default:currentPacki.localPackiData.owner, onValidate: packiValids.validatePackiName },
                    repoName: {type: 'text', label: 'Repo', default: currentPacki.localPackiData.repoName,  onValidate: packiValids.validatePackiName },
                    branch: {type: 'text', label: 'Branch', default: currentPacki.localPackiData.branch, onValidate: packiValids.validatePackiName },
                  }} />
              </ModalDialog>
              )}
              { currentPacki && currentPacki.localPackiData && (
              <ModalDialog
                title="Create git package"
                visible={currentModal === 'github-create'}
                onDismiss={this._handleHideModal}>
                <EditorForm
                  title="Create git package"
                  action="Confirm"
                  visible={currentModal==='github-create'}
                  onDismiss={this._handleHideModal}
                  onSubmit={values => {
                    alert(JSON.stringify(values));
                    this._handleCreateGitRepository(values['owner'], values['repoName'], values['branch']);
                  }}
                  fields={{
                    owner: {type: 'text', label: 'Owner', default:currentPacki.localPackiData.owner, onValidate: packiValids.validatePackiName },
                    repoName: {type: 'text', label: 'Repo', default: currentPacki.localPackiData.repoName,  onValidate: packiValids.validatePackiName },
                    branch: {type: 'text', label: 'Branch', default: currentPacki.localPackiData.branch, onValidate: packiValids.validatePackiName },
                  }} />
              </ModalDialog>
              )}
            )}
        </React.Fragment>
        </ContentShell>
      ) 
    }
}

const c = prefColors.c;
const styles = StyleSheet.create({
  editorAreaOuter: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
  },

  editorAreaOuterWrapper: {
    display: 'flex',
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    minWidth: 0,
    marginTop: '12px',
    marginLeft: '72px',
    height: '100%',
  },
});

const muiStyles =  (theme: Theme) => createStyles({
  drawerPaper: {
    top: 0 // 'auto'
  }, 
});

const StyledComp = withStyles(muiStyles)(EditorView);
export default withPreferences(StyledComp);
