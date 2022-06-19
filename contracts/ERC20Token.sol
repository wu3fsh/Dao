//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract ERC20Token {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _totalSupply;
    address private _owner;

    modifier restricted() {
        require(
            msg.sender == _owner,
            "Only the owner of the contract can perform this operation"
        );
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply
    ) {
        _name = name;
        _symbol = symbol;
        _decimals = decimals;
        _totalSupply = totalSupply * (uint256(10)**decimals);
        _balances[msg.sender] = _totalSupply;
        _owner = msg.sender;

        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function allowance(address owner, address spender)
        external
        view
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    function transfer(address to, uint256 value) external returns (bool) {
        require(
            _balances[msg.sender] >= value,
            "Account doesn't have enough money to transfer"
        );

        _balances[msg.sender] -= value;
        _balances[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool) {
        require(
            _balances[from] >= value,
            "Account doesn't have enough money to transfer"
        );
        require(
            _allowances[from][msg.sender] >= value,
            "Money transfer limit exceeded"
        );

        _allowances[from][msg.sender] -= value;
        _balances[from] -= value;
        _balances[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function burn(address account, uint256 amount) external restricted {
        require(
            _balances[account] >= amount,
            "Account doesn't have enough money to burn"
        );

        _balances[account] -= amount;
        _totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }

    function mint(address account, uint256 amount) external restricted {
        _balances[account] += amount;
        _totalSupply += amount;
        emit Transfer(address(0), account, amount);
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}
