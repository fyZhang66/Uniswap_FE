// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./libraries/UniswapV2Library.sol";
import "./interfaces/IERC20.sol";

contract UniswapV2Router {
    address public immutable factory;
    
    // Maximum deadline window for transactions
    uint private constant DEADLINE_WINDOW = 20 minutes;

    constructor(address _factory) {
        factory = _factory;
    }

    // Helper function to calculate a deadline if none is provided
    function _getDeadline(uint deadline) private view returns (uint) {
        return deadline == 0 ? block.timestamp + DEADLINE_WINDOW : deadline;
    }

    // Add liquidity to a pair
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        deadline = _getDeadline(deadline);
        require(block.timestamp <= deadline, "UniswapV2Router: EXPIRED");

        // Create pair if it doesn't exist
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = IUniswapV2Factory(factory).createPair(tokenA, tokenB);
        }

        // Get reserves
        (uint reserveA, uint reserveB) = UniswapV2Library.getReserves(factory, tokenA, tokenB);

        // Calculate optimal amounts
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = UniswapV2Library.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "UniswapV2Router: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = UniswapV2Library.quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal <= amountADesired, "UniswapV2Router: EXCESSIVE_A_AMOUNT");
                require(amountAOptimal >= amountAMin, "UniswapV2Router: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }

        // Transfer tokens to pair
        _safeTransferFrom(tokenA, msg.sender, pair, amountA);
        _safeTransferFrom(tokenB, msg.sender, pair, amountB);

        // Mint liquidity tokens
        liquidity = IUniswapV2Pair(pair).mint(to);
        
        return (amountA, amountB, liquidity);
    }
    
    // Remove liquidity from a pair
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB) {
        deadline = _getDeadline(deadline);
        require(block.timestamp <= deadline, "UniswapV2Router: EXPIRED");
        
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "UniswapV2Router: PAIR_DOES_NOT_EXIST");
        
        // Transfer liquidity tokens to pair
        IUniswapV2Pair(pair).transferFrom(msg.sender, pair, liquidity);
        
        // Burn liquidity tokens and get token amounts
        (uint amount0, uint amount1) = IUniswapV2Pair(pair).burn(to);
        
        (address token0,) = UniswapV2Library.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        
        require(amountA >= amountAMin, "UniswapV2Router: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "UniswapV2Router: INSUFFICIENT_B_AMOUNT");
        
        return (amountA, amountB);
    }
    
    // Swap exact tokens for tokens
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        deadline = _getDeadline(deadline);
        require(block.timestamp <= deadline, "UniswapV2Router: EXPIRED");
        require(path.length >= 2, "UniswapV2Router: INVALID_PATH");
        
        // Calculate amounts
        amounts = UniswapV2Library.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
        
        // Transfer input tokens to first pair
        address pair = IUniswapV2Factory(factory).getPair(path[0], path[1]);
        _safeTransferFrom(path[0], msg.sender, pair, amounts[0]);
        
        // Perform swaps
        _swap(amounts, path, to);
        
        return amounts;
    }
    
    // Swap tokens for exact tokens
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        deadline = _getDeadline(deadline);
        require(block.timestamp <= deadline, "UniswapV2Router: EXPIRED");
        require(path.length >= 2, "UniswapV2Router: INVALID_PATH");
        
        // Calculate amounts
        amounts = UniswapV2Library.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "UniswapV2Router: EXCESSIVE_INPUT_AMOUNT");
        
        // Transfer input tokens to first pair
        address pair = IUniswapV2Factory(factory).getPair(path[0], path[1]);
        _safeTransferFrom(path[0], msg.sender, pair, amounts[0]);
        
        // Perform swaps
        _swap(amounts, path, to);
        
        return amounts;
    }
    
    // Internal function to perform swaps
    function _swap(uint[] memory amounts, address[] memory path, address _to) internal {
        for (uint i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = UniswapV2Library.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 
                ? (uint(0), amountOut) 
                : (amountOut, uint(0));
            
            address to = i < path.length - 2 
                ? IUniswapV2Factory(factory).getPair(output, path[i + 2])
                : _to;
                
            IUniswapV2Pair(IUniswapV2Factory(factory).getPair(input, output))
                .swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }
    
    // Helper to safely transfer tokens
    function _safeTransferFrom(address token, address from, address to, uint value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "UniswapV2Router: TRANSFER_FAILED"
        );
    }
    
    // Quote function for easier access
    function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB) {
        return UniswapV2Library.quote(amountA, reserveA, reserveB);
    }
    
    // View functions for calculating swap amounts
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut) {
        return UniswapV2Library.getAmountOut(amountIn, reserveIn, reserveOut);
    }
    
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint amountIn) {
        return UniswapV2Library.getAmountIn(amountOut, reserveIn, reserveOut);
    }
    
    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts) {
        return UniswapV2Library.getAmountsOut(factory, amountIn, path);
    }
    
    function getAmountsIn(uint amountOut, address[] memory path) external view returns (uint[] memory amounts) {
        return UniswapV2Library.getAmountsIn(factory, amountOut, path);
    }
}