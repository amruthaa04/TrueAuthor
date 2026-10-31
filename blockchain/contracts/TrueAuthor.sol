// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TrueAuthor {

    // ============================================================
    // CONSTANTS
    // ============================================================

    // Mandatory 5% platform fee.
    // 500 basis points = 5%
    uint256 public constant PLATFORM_FEE_BPS = 500;

    // Remaining 95% must be distributed to creator/collaborators.
    // 9500 basis points = 95%
    uint256 public constant CREATOR_POOL_BPS = 9500;


    // ============================================================
    // PLATFORM
    // ============================================================

    // Wallet receiving the mandatory 5% platform fee.
    address payable public platformWallet;


    // ============================================================
    // WORK RECORD
    // ============================================================

    struct WorkRecord {

        bytes32 workHash;

        string ipfsCid;

        // Permanent blockchain owner
        address owner;

        // Original creator
        address creator;

        uint256 timestamp;

        bool exists;
    }


    // ============================================================
    // ROYALTY SHARE
    // ============================================================

    struct RoyaltyShare {

        // Artist/collaborator wallet
        address account;

        // Share of the 95% creator royalty pool.
        //
        // Example:
        // 7000 = 70% of total creator pool
        // 2000 = 20%
        // 500  = 5%
        //
        // Total must equal 9500.
        uint256 shareBps;
    }


    // ============================================================
    // LICENSE OFFER
    // ============================================================

    struct LicenseOffer {

        bytes32 workHash;

        // Person listing the work
        address seller;

        // Price in wei
        uint256 price;

        // License duration in seconds
        uint256 duration;

        // Distribution of the 95% creator pool
        RoyaltyShare[] royaltyShares;

        bool active;
    }


    // ============================================================
    // LICENSE RECORD
    // ============================================================

    struct License {

        bytes32 workHash;

        // Buyer
        address licensee;

        // Artist / seller
        address licensor;

        // Amount paid
        uint256 pricePaid;

        // License start
        uint256 startTime;

        // License expiry
        uint256 expiryTime;

        bool exists;
    }


    // ============================================================
    // MAPPINGS
    // ============================================================

    mapping(bytes32 => WorkRecord) private works;

    mapping(bytes32 => LicenseOffer)
        private licenseOffers;

    // workHash => buyer => license
    mapping(bytes32 => mapping(address => License))
        private licenses;


    // ============================================================
    // EVENTS
    // ============================================================

    event WorkRegistered(
        bytes32 indexed workHash,
        string ipfsCid,
        address indexed owner,
        uint256 timestamp
    );


    event LicenseListed(
        bytes32 indexed workHash,
        address indexed seller,
        uint256 price,
        uint256 duration
    );


    event RoyaltyShareConfigured(
        bytes32 indexed workHash,
        address indexed account,
        uint256 shareBps
    );


    event LicenseCancelled(
        bytes32 indexed workHash
    );


    event PlatformFeePaid(
        bytes32 indexed workHash,
        address indexed platformWallet,
        uint256 amount
    );


    event RoyaltyPaid(
        bytes32 indexed workHash,
        address indexed recipient,
        uint256 amount
    );


    event LicensePurchased(
        bytes32 indexed workHash,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 startTime,
        uint256 expiryTime,
        uint256 platformFee
    );


    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor(
        address payable _platformWallet
    ) {

        require(
            _platformWallet != address(0),
            "Invalid platform wallet"
        );

        platformWallet =
            _platformWallet;
    }


    // ============================================================
    // REGISTER WORK
    // ============================================================

    function registerWork(
        bytes32 workHash,
        string calldata ipfsCid
    )
        external
    {

        require(
            !works[workHash].exists,
            "Work is already registered"
        );

        works[workHash] =
            WorkRecord({

                workHash:
                    workHash,

                ipfsCid:
                    ipfsCid,

                owner:
                    msg.sender,

                creator:
                    msg.sender,

                timestamp:
                    block.timestamp,

                exists:
                    true
            });

        emit WorkRegistered(

            workHash,

            ipfsCid,

            msg.sender,

            block.timestamp
        );
    }


    // ============================================================
    // VERIFY WORK
    // ============================================================

    function verifyWork(
        bytes32 workHash
    )
        external
        view
        returns (
            bool exists,
            string memory ipfsCid,
            address owner,
            uint256 timestamp
        )
    {

        WorkRecord memory work =
            works[workHash];

        return (

            work.exists,

            work.ipfsCid,

            work.owner,

            work.timestamp
        );
    }


    // ============================================================
    // GET CREATOR
    // ============================================================

    function getWorkCreator(
        bytes32 workHash
    )
        external
        view
        returns (
            address creator
        )
    {

        require(
            works[workHash].exists,
            "Work does not exist"
        );

        return
            works[workHash].creator;
    }


    // ============================================================
    // LIST WORK FOR LICENSE
    // ============================================================

    function listWork(
        bytes32 workHash,
        uint256 price,
        uint256 duration,
        address[] calldata royaltyAccounts,
        uint256[] calldata royaltyShares
    )
        external
    {

        require(
            works[workHash].exists,
            "Work does not exist"
        );

        require(
            works[workHash].owner == msg.sender,
            "Only the owner can list the work"
        );

        require(
            price > 0,
            "Price must be greater than zero"
        );

        require(
            duration > 0,
            "License duration must be greater than zero"
        );

        require(
            royaltyAccounts.length > 0,
            "At least one royalty recipient is required"
        );

        require(
            royaltyAccounts.length ==
            royaltyShares.length,
            "Royalty arrays length mismatch"
        );


        // ========================================================
        // CLEAR PREVIOUS ROYALTY SHARES
        // ========================================================

        delete licenseOffers[workHash].royaltyShares;


        // ========================================================
        // VALIDATE TOTAL ROYALTY DISTRIBUTION
        // ========================================================

        uint256 totalShares = 0;


        for (
            uint256 i = 0;
            i < royaltyAccounts.length;
            i++
        ) {

            require(
                royaltyAccounts[i] != address(0),
                "Invalid royalty recipient"
            );

            require(
                royaltyShares[i] > 0,
                "Royalty share must be greater than zero"
            );


            // Prevent duplicate recipients
            for (
                uint256 j = 0;
                j < i;
                j++
            ) {

                require(
                    royaltyAccounts[j] !=
                    royaltyAccounts[i],
                    "Duplicate royalty recipient"
                );
            }


            totalShares +=
                royaltyShares[i];
        }


        // ========================================================
        // EXACTLY 95% MUST GO TO ARTISTS
        // ========================================================

        require(
            totalShares == CREATOR_POOL_BPS,
            "Royalty shares must total exactly 95%"
        );


        // ========================================================
        // CREATE LICENSE OFFER
        // ========================================================

        licenseOffers[workHash] =
            LicenseOffer({

                workHash:
                    workHash,

                seller:
                    msg.sender,

                price:
                    price,

                duration:
                    duration,

                royaltyShares:
                    new RoyaltyShare[](0),

                active:
                    true
            });


        // ========================================================
        // STORE ROYALTY RECIPIENTS
        // ========================================================

        for (
            uint256 i = 0;
            i < royaltyAccounts.length;
            i++
        ) {

            licenseOffers[workHash]
                .royaltyShares
                .push(

                    RoyaltyShare({

                        account:
                            royaltyAccounts[i],

                        shareBps:
                            royaltyShares[i]
                    })
                );


            emit RoyaltyShareConfigured(

                workHash,

                royaltyAccounts[i],

                royaltyShares[i]
            );
        }


        emit LicenseListed(

            workHash,

            msg.sender,

            price,

            duration
        );
    }


    // ============================================================
    // CANCEL LICENSE OFFER
    // ============================================================

    function cancelLicense(
        bytes32 workHash
    )
        external
    {

        LicenseOffer storage offer =
            licenseOffers[workHash];


        require(
            offer.active,
            "Work is not listed for licensing"
        );


        require(
            offer.seller == msg.sender,
            "Only the seller can cancel the listing"
        );


        offer.active =
            false;


        emit LicenseCancelled(
            workHash
        );
    }


    // ============================================================
    // GET LICENSE OFFER
    // ============================================================

    function getLicenseOffer(
        bytes32 workHash
    )
        external
        view
        returns (
            address seller,
            uint256 price,
            uint256 duration,
            uint256 totalRoyaltyBps,
            bool active
        )
    {

        LicenseOffer memory offer =
            licenseOffers[workHash];


        return (

            offer.seller,

            offer.price,

            offer.duration,

            CREATOR_POOL_BPS,

            offer.active
        );
    }


    // ============================================================
    // GET ROYALTY SHARES
    // ============================================================

    function getRoyaltyShares(
        bytes32 workHash
    )
        external
        view
        returns (
            address[] memory accounts,
            uint256[] memory shares
        )
    {

        LicenseOffer memory offer =
            licenseOffers[workHash];


        uint256 length =
            offer.royaltyShares.length;


        accounts =
            new address[](length);

        shares =
            new uint256[](length);


        for (
            uint256 i = 0;
            i < length;
            i++
        ) {

            accounts[i] =
                offer
                    .royaltyShares[i]
                    .account;

            shares[i] =
                offer
                    .royaltyShares[i]
                    .shareBps;
        }


        return (
            accounts,
            shares
        );
    }


    // ============================================================
    // PURCHASE LICENSE
    // ============================================================

    function purchaseLicense(
        bytes32 workHash
    )
        external
        payable
    {

        WorkRecord storage work =
            works[workHash];

        LicenseOffer storage offer =
            licenseOffers[workHash];


        // ========================================================
        // VALIDATION
        // ========================================================

        require(
            work.exists,
            "Work does not exist"
        );


        require(
            offer.active,
            "License is not available"
        );


        require(
            msg.value == offer.price,
            "Incorrect payment amount"
        );


        require(
            msg.sender != offer.seller,
            "Owner cannot purchase own license"
        );


        // ========================================================
        // LICENSE PERIOD
        // ========================================================

        uint256 startTime =
            block.timestamp;


        uint256 expiryTime =
            startTime +
            offer.duration;


        // ========================================================
        // PLATFORM FEE
        // ========================================================

        // 5% of the total purchase price.
        uint256 platformFee =
            (msg.value *
                PLATFORM_FEE_BPS) /
            10000;


        // ========================================================
        // CREATOR ROYALTY POOL
        // ========================================================

        uint256 creatorPool =
            msg.value -
            platformFee;


        require(
            creatorPool > 0,
            "Creator pool cannot be zero"
        );


        // ========================================================
        // STORE LICENSE
        // ========================================================

        licenses[workHash][msg.sender] =
            License({

                workHash:
                    workHash,

                licensee:
                    msg.sender,

                licensor:
                    offer.seller,

                pricePaid:
                    msg.value,

                startTime:
                    startTime,

                expiryTime:
                    expiryTime,

                exists:
                    true
            });


        // ========================================================
        // PAY PLATFORM
        // ========================================================

        if (
            platformFee > 0
        ) {

            (
                bool platformSuccess,
            ) =
                platformWallet.call{
                    value:
                        platformFee
                }("");

            require(
                platformSuccess,
                "Platform fee payment failed"
            );


            emit PlatformFeePaid(

                workHash,

                platformWallet,

                platformFee
            );
        }


        // ========================================================
        // DISTRIBUTE CREATOR ROYALTY
        // ========================================================

        uint256 distributed =
            0;


        for (
            uint256 i = 0;
            i <
            offer
                .royaltyShares
                .length;
            i++
        ) {

            RoyaltyShare memory share =
                offer
                    .royaltyShares[i];


            uint256 payment =
                (
                    creatorPool *
                    share.shareBps
                ) /
                CREATOR_POOL_BPS;


            if (
                payment > 0
            ) {

                (
                    bool success,
                ) =
                    payable(
                        share.account
                    ).call{
                        value:
                            payment
                    }("");


                require(
                    success,
                    "Royalty payment failed"
                );


                distributed +=
                    payment;


                emit RoyaltyPaid(

                    workHash,

                    share.account,

                    payment
                );
            }
        }


        // Make sure the entire 95% pool was distributed.
        require(
            distributed == creatorPool,
            "Creator royalty distribution incomplete"
        );


        // ========================================================
        // EMIT PURCHASE EVENT
        // ========================================================

        emit LicensePurchased(

            workHash,

            msg.sender,

            offer.seller,

            msg.value,

            startTime,

            expiryTime,

            platformFee
        );
    }


    // ============================================================
    // CHECK LICENSE
    // ============================================================

    function hasValidLicense(
        bytes32 workHash,
        address user
    )
        external
        view
        returns (
            bool
        )
    {

        License memory license =
            licenses[workHash][user];


        if (
            !license.exists
        ) {

            return false;
        }


        return
            block.timestamp <
            license.expiryTime;
    }


    // ============================================================
    // GET LICENSE DETAILS
    // ============================================================

    function getLicense(
        bytes32 workHash,
        address user
    )
        external
        view
        returns (

            address licensee,

            address licensor,

            uint256 pricePaid,

            uint256 startTime,

            uint256 expiryTime,

            bool exists,

            bool active
        )
    {

        License memory license =
            licenses[workHash][user];


        bool currentlyActive =
            license.exists &&
            block.timestamp <
            license.expiryTime;


        return (

            license.licensee,

            license.licensor,

            license.pricePaid,

            license.startTime,

            license.expiryTime,

            license.exists,

            currentlyActive
        );
    }


    // ============================================================
    // UPDATE PLATFORM WALLET
    // ============================================================

    function updatePlatformWallet(
        address payable newWallet
    )
        external
    {

        // For the current student-project version,
        // only the current platform wallet can update it.
        require(
            msg.sender ==
            platformWallet,
            "Only platform wallet can update"
        );


        require(
            newWallet != address(0),
            "Invalid platform wallet"
        );


        platformWallet =
            newWallet;
    }
}