import UIKit

/// Native (UIKit) in-call screen shown for the duration of a live call.
///
/// Why native instead of the web overlay: the foreground Capacitor WKWebView
/// holds the AVAudioSession in a way that blocks the speaker route — only the
/// webview going off-screen (backgrounding) frees it. Presenting this screen
/// full-screen AND hiding the webview reproduces that "off-screen" state without
/// leaving the app, so `overrideOutputAudioPort(.speaker)` finally engages. The
/// controls call straight into the plugin (no webview round-trip), so they work
/// regardless of what the web layer is doing.
final class NativeCallViewController: UIViewController {
    var onToggleMute: ((Bool) -> Void)?
    var onToggleSpeaker: ((Bool) -> Void)?
    var onEnd: (() -> Void)?

    private let displayName: String
    private let subtitle: String?

    private var isMuted = false
    private var isSpeaker = false
    private var seconds = 0
    private var timer: Timer?
    private var connected = false

    private let nameLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let statusLabel = UILabel()
    private let avatarLabel = UILabel()
    private let muteButton = UIButton(type: .system)
    private let speakerButton = UIButton(type: .system)

    init(displayName: String, subtitle: String?) {
        self.displayName = displayName.isEmpty ? "Unknown Caller" : displayName
        self.subtitle = subtitle
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
        modalTransitionStyle = .crossDissolve
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.10, green: 0.10, blue: 0.11, alpha: 1.0)

        // Avatar
        let avatar = UIView()
        avatar.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        avatar.layer.cornerRadius = 56
        avatar.translatesAutoresizingMaskIntoConstraints = false
        avatarLabel.text = String((displayName.trimmingCharacters(in: .whitespaces).first ?? "?")).uppercased()
        avatarLabel.font = .systemFont(ofSize: 44, weight: .light)
        avatarLabel.textColor = .white
        avatarLabel.translatesAutoresizingMaskIntoConstraints = false
        avatar.addSubview(avatarLabel)

        nameLabel.text = displayName
        nameLabel.font = .systemFont(ofSize: 28, weight: .semibold)
        nameLabel.textColor = .white
        nameLabel.textAlignment = .center
        nameLabel.numberOfLines = 2

        subtitleLabel.text = subtitle
        subtitleLabel.font = .systemFont(ofSize: 16)
        subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.6)
        subtitleLabel.textAlignment = .center
        subtitleLabel.isHidden = (subtitle == nil || subtitle?.isEmpty == true)

        statusLabel.text = "Connecting…"
        statusLabel.font = .monospacedDigitSystemFont(ofSize: 18, weight: .regular)
        statusLabel.textColor = UIColor.white.withAlphaComponent(0.6)
        statusLabel.textAlignment = .center

        let identity = UIStackView(arrangedSubviews: [nameLabel, subtitleLabel, statusLabel])
        identity.axis = .vertical
        identity.spacing = 6
        identity.alignment = .center
        identity.translatesAutoresizingMaskIntoConstraints = false

        // Controls
        styleCircleButton(muteButton, systemName: "mic.fill", title: "Mute")
        styleCircleButton(speakerButton, systemName: "speaker.wave.2.fill", title: "Speaker")
        muteButton.addTarget(self, action: #selector(muteTapped), for: .touchUpInside)
        speakerButton.addTarget(self, action: #selector(speakerTapped), for: .touchUpInside)

        let controlsRow = UIStackView(arrangedSubviews: [muteButton, speakerButton])
        controlsRow.axis = .horizontal
        controlsRow.spacing = 56
        controlsRow.alignment = .center

        let endButton = UIButton(type: .system)
        endButton.backgroundColor = UIColor(red: 0.86, green: 0.15, blue: 0.15, alpha: 1.0)
        endButton.tintColor = .white
        endButton.setImage(UIImage(systemName: "phone.down.fill"), for: .normal)
        endButton.layer.cornerRadius = 36
        endButton.translatesAutoresizingMaskIntoConstraints = false
        endButton.addTarget(self, action: #selector(endTapped), for: .touchUpInside)

        let controls = UIStackView(arrangedSubviews: [controlsRow, endButton])
        controls.axis = .vertical
        controls.spacing = 40
        controls.alignment = .center
        controls.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(avatar)
        view.addSubview(identity)
        view.addSubview(controls)

        NSLayoutConstraint.activate([
            avatar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 48),
            avatar.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            avatar.widthAnchor.constraint(equalToConstant: 112),
            avatar.heightAnchor.constraint(equalToConstant: 112),
            avatarLabel.centerXAnchor.constraint(equalTo: avatar.centerXAnchor),
            avatarLabel.centerYAnchor.constraint(equalTo: avatar.centerYAnchor),

            identity.topAnchor.constraint(equalTo: avatar.bottomAnchor, constant: 24),
            identity.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            identity.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),

            controls.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -40),
            controls.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            endButton.widthAnchor.constraint(equalToConstant: 72),
            endButton.heightAnchor.constraint(equalToConstant: 72),
        ])
    }

    private func styleCircleButton(_ button: UIButton, systemName: String, title: String) {
        button.translatesAutoresizingMaskIntoConstraints = false
        button.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        button.tintColor = .white
        button.setImage(UIImage(systemName: systemName), for: .normal)
        button.layer.cornerRadius = 36
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: 72),
            button.heightAnchor.constraint(equalToConstant: 72),
        ])
        button.accessibilityLabel = title
    }

    // MARK: - State updates (called by the plugin)

    func markConnected() {
        guard !connected else { return }
        connected = true
        statusLabel.text = "0:00"
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.seconds += 1
            self.statusLabel.text = String(format: "%d:%02d", self.seconds / 60, self.seconds % 60)
        }
    }

    func setMuted(_ muted: Bool) {
        isMuted = muted
        refreshToggle(muteButton, on: muted, onImage: "mic.slash.fill", offImage: "mic.fill")
    }

    func setSpeaker(_ on: Bool) {
        isSpeaker = on
        refreshToggle(speakerButton, on: on, onImage: "speaker.wave.2.fill", offImage: "speaker.wave.2.fill")
    }

    private func refreshToggle(_ button: UIButton, on: Bool, onImage: String, offImage: String) {
        button.setImage(UIImage(systemName: on ? onImage : offImage), for: .normal)
        button.backgroundColor = on ? .white : UIColor.white.withAlphaComponent(0.15)
        button.tintColor = on ? UIColor(red: 0.10, green: 0.10, blue: 0.11, alpha: 1.0) : .white
    }

    // MARK: - Actions

    @objc private func muteTapped() {
        isMuted.toggle()
        setMuted(isMuted)
        onToggleMute?(isMuted)
    }

    @objc private func speakerTapped() {
        isSpeaker.toggle()
        setSpeaker(isSpeaker)
        onToggleSpeaker?(isSpeaker)
    }

    @objc private func endTapped() {
        onEnd?()
    }

    deinit { timer?.invalidate() }
}
